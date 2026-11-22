import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaCode,
  BaseChannel,
  ConnectionStatus,
  ConnectionStatusHandler,
  DirectChannel,
  DirectChannelIdentifier,
  LogLevel,
  Message,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
  SentStatus,
} from '@nexconn/chat';
import { User } from 'firebase/auth';
import {
  loadBranchMessageOwnership,
  saveBranchMessageOwnership,
} from './visitorStorage';

export interface NexconnStatusResponse {
  configured: boolean;
  serverConfigured: boolean;
  appKeyConfigured: boolean;
  appKey?: string;
  supportTargetId: string;
  missing: string[];
}

export interface NexconnUiMessage {
  id: string;
  senderUserId: string;
  isMine: boolean;
  text: string;
  sentTime: number;
  status: 'sending' | 'sent' | 'failed';
}

export type NexconnSdkState =
  | 'checking'
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

function resolveAreaCodeFromToken(token: string): AreaCode {
  const lower = token.toLowerCase();
  if (lower.includes('.na.')) return AreaCode.NA;
  if (lower.includes('.bj.')) return AreaCode.BJ;
  if (lower.includes('.sa.')) return AreaCode.SA;
  if (lower.includes('.om.')) return AreaCode.OM;
  return AreaCode.SG;
}

function extractMessageText(msg: Message<Record<string, unknown>>): string {
  const content = msg.content;
  if (content && typeof content.text === 'string') return content.text;
  if (content && typeof content.content === 'string') return content.content;
  if (msg.messageType && msg.messageType !== 'RC:TxtMsg') {
    return `[${msg.messageType}]`;
  }
  return '';
}

interface UseVisitorNexconnParams {
  enabled: boolean;
  firebaseUser: User | null;
  isDemoVisitor: boolean;
  displayName: string;
  activeVisitorUid: string | null;
  isViewingDeskChat: boolean;
  activeBranchKey: string | null;
}

export function useVisitorNexconn({
  enabled,
  firebaseUser,
  isDemoVisitor,
  displayName,
  activeVisitorUid,
  isViewingDeskChat,
  activeBranchKey,
}: UseVisitorNexconnParams) {
  const envClientAppKey =
    (import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined)?.trim() || '';

  const [sdkState, setSdkState] = useState<NexconnSdkState>('checking');
  const [statusData, setStatusData] = useState<NexconnStatusResponse | null>(null);
  const [sdkError, setSdkError] = useState('');
  const [supportTargetId, setSupportTargetId] = useState('lineless_support');
  const [connectedUserId, setConnectedUserId] = useState('');
  const [messages, setMessages] = useState<NexconnUiMessage[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootNonce, setBootNonce] = useState(0);

  const [branchOwnership, setBranchOwnership] = useState<Record<string, string>>(() =>
    loadBranchMessageOwnership(activeVisitorUid)
  );

  const historyQueryRef = useRef<ReturnType<typeof BaseChannel.createMessagesQuery> | null>(null);
  const isViewingDeskChatRef = useRef(isViewingDeskChat);
  isViewingDeskChatRef.current = isViewingDeskChat;
  const activeBranchKeyRef = useRef(activeBranchKey);
  activeBranchKeyRef.current = activeBranchKey;
  const lastOutboundBranchRef = useRef<string | null>(activeBranchKey);
  if (activeBranchKey) {
    lastOutboundBranchRef.current = activeBranchKey;
  }
  const supportTargetRef = useRef(supportTargetId);
  supportTargetRef.current = supportTargetId;

  useEffect(() => {
    setBranchOwnership(loadBranchMessageOwnership(activeVisitorUid));
  }, [activeVisitorUid]);

  const recordBranchMessages = useCallback(
    (msgIds: string[], branchKey: string | null) => {
      if (!branchKey || msgIds.length === 0) return;
      setBranchOwnership((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of msgIds) {
          if (id && next[id] !== branchKey) {
            next[id] = branchKey;
            changed = true;
          }
        }
        if (!changed) return prev;
        saveBranchMessageOwnership(activeVisitorUid, next);
        return next;
      });
    },
    [activeVisitorUid]
  );

  const clearDeskUnread = useCallback(async () => {
    setUnreadCount(0);
    if (sdkState !== 'connected') return;
    try {
      const ch = new DirectChannel(supportTargetRef.current);
      await ch.clearUnreadCount().catch(() => {});
    } catch {
      // Ignore if SDK disconnected
    }
  }, [sdkState]);

  // Automatically clear unread count whenever visitor opens/views Desk Chat
  useEffect(() => {
    if (isViewingDeskChat && unreadCount > 0) {
      void clearDeskUnread();
    }
  }, [isViewingDeskChat, unreadCount, clearDeskUnread]);

  const mapSdkMessages = useCallback(
    (rawList: Message<Record<string, unknown>>[], myUid: string): NexconnUiMessage[] => {
      return rawList
        .map((m) => {
          const text = extractMessageText(m);
          if (!text) return null;
          return {
            id: m.messageId || `${m.senderUserId}_${m.sentTime}`,
            senderUserId: m.senderUserId,
            isMine: m.senderUserId === myUid,
            text,
            sentTime: m.sentTime || Date.now(),
            status:
              m.sentStatus === SentStatus.FAILED
                ? 'failed'
                : m.sentStatus === SentStatus.SENDING
                ? 'sending'
                : 'sent',
          } satisfies NexconnUiMessage;
        })
        .filter((x): x is NexconnUiMessage => x !== null)
        .sort((a, b) => a.sentTime - b.sentTime);
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const handlerId = `lineless_visitor_chat_${Date.now()}`;

    async function bootNexconn() {
      setSdkState('checking');
      setSdkError('');
      setSendError('');

      try {
        const statusRes = await fetch('/api/nexconn/status');
        if (!statusRes.ok) {
          throw new Error('Unable to verify Nexconn configuration endpoint.');
        }
        const statusJson = (await statusRes.json()) as NexconnStatusResponse;
        if (cancelled) return;
        setStatusData(statusJson);

        const resolvedAppKey = envClientAppKey || statusJson.appKey || '';
        const defaultTarget = statusJson.supportTargetId || 'lineless_support';
        setSupportTargetId(defaultTarget);
        supportTargetRef.current = defaultTarget;

        if (!resolvedAppKey || !statusJson.serverConfigured) {
          setSdkState('unconfigured');
          return;
        }

        setSdkState('connecting');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          headers.Authorization = `Bearer ${idToken}`;
        }

        const tokenRes = await fetch('/api/nexconn/token', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: displayName,
            isDemoVisitor,
            demoSessionId: activeVisitorUid || 'demo',
          }),
        });

        const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
          token?: string;
          userId?: string;
          supportTargetId?: string;
          error?: string;
          configured?: boolean;
        };

        if (cancelled) return;

        if (!tokenRes.ok || !tokenJson.token) {
          if (tokenJson.configured === false) {
            setSdkState('unconfigured');
            return;
          }
          throw new Error(tokenJson.error || 'Unable to obtain Nexconn session token.');
        }

        const targetSupportId = tokenJson.supportTargetId || defaultTarget;
        setSupportTargetId(targetSupportId);
        supportTargetRef.current = targetSupportId;

        const areaCode = resolveAreaCodeFromToken(tokenJson.token);
        try {
          await NCEngine.disconnect().catch(() => {});
          NCEngine.initialize({
            appKey: resolvedAppKey,
            areaCode,
            logLevel: LogLevel.WARN,
          });
        } catch {
          // Already initialized in same lifecycle
        }

        NCEngine.addConnectionStatusHandler(
          handlerId,
          new ConnectionStatusHandler({
            onConnectionStatusChanged: ({ status }) => {
              if (cancelled) return;
              if (status === ConnectionStatus.CONNECTED) {
                setSdkState('connected');
              } else if (
                status === ConnectionStatus.CONNECTING ||
                status === ConnectionStatus.SUSPENDED ||
                status === ConnectionStatus.DISCONNECTED
              ) {
                setSdkState('reconnecting');
              }
            },
          })
        );

        const connectRes = await NCEngine.connect({ token: tokenJson.token });
        if (cancelled) return;
        if (!connectRes.isOk) {
          throw new Error(`Nexconn connection failed (code ${connectRes.code}).`);
        }

        const myUid =
          connectRes.data?.userId || tokenJson.userId || NCEngine.getCurrentUserId();
        setConnectedUserId(myUid);

        const targetIdentifier = new DirectChannelIdentifier(targetSupportId);

        NCEngine.addMessageHandler(
          handlerId,
          new MessageHandler({
            onMessageReceived: ({ messages: incoming }) => {
              if (cancelled || !incoming?.length) return;
              const relevant = incoming.filter(
                (m) => m.channelIdentifier?.channelId === targetSupportId
              );
              if (relevant.length === 0) return;

              const mapped = mapSdkMessages(relevant, myUid);
              const routeBranch =
                activeBranchKeyRef.current || lastOutboundBranchRef.current;
              const staffRepliesToRoute = mapped.filter((m) => !m.isMine);
              if (routeBranch && staffRepliesToRoute.length > 0) {
                recordBranchMessages(
                  staffRepliesToRoute.map((m) => m.id),
                  routeBranch
                );
              }

              setMessages((prev) => {
                const byId = new Map(prev.map((p) => [p.id, p]));
                for (const item of mapped) {
                  byId.set(item.id, item);
                }
                return Array.from(byId.values()).sort((a, b) => a.sentTime - b.sentTime);
              });

              const incomingStaffReplies = mapped.filter((m) => !m.isMine);
              if (incomingStaffReplies.length > 0) {
                if (isViewingDeskChatRef.current) {
                  const ch = new DirectChannel(targetSupportId);
                  void ch.clearUnreadCount().catch(() => {});
                  setUnreadCount(0);
                } else {
                  setUnreadCount((c) => c + incomingStaffReplies.length);
                }
              }
            },
          })
        );

        const query = BaseChannel.createMessagesQuery({
          channelIdentifier: targetIdentifier,
          pageSize: 40,
        });
        historyQueryRef.current = query;
        const pageRes = await query.loadNextPage();
        if (!cancelled && pageRes.isOk && pageRes.data?.data) {
          setMessages(mapSdkMessages(pageRes.data.data, myUid));
          setHasMoreHistory(query.hasNext);
        } else if (!cancelled) {
          setMessages([]);
          setHasMoreHistory(false);
        }

        try {
          const unreadRes = await BaseChannel.getTotalUnreadCount();
          if (!cancelled && unreadRes.isOk && typeof unreadRes.data === 'number') {
            if (isViewingDeskChatRef.current) {
              const ch = new DirectChannel(targetSupportId);
              await ch.clearUnreadCount().catch(() => {});
              setUnreadCount(0);
            } else {
              setUnreadCount(unreadRes.data);
            }
          }
        } catch {
          // Ignore unread fetch failure
        }

        if (!cancelled) {
          setSdkState('connected');
        }
      } catch (err) {
        if (cancelled) return;
        setSdkError(
          err instanceof Error ? err.message : 'Unable to connect to Nexconn Live Chat.'
        );
        setSdkState('error');
      }
    }

    void bootNexconn();

    return () => {
      cancelled = true;
      NCEngine.removeMessageHandler(handlerId);
      NCEngine.removeConnectionStatusHandler(handlerId);
      historyQueryRef.current = null;
      void NCEngine.disconnect().catch(() => {});
    };
  }, [
    enabled,
    envClientAppKey,
    firebaseUser,
    isDemoVisitor,
    displayName,
    activeVisitorUid,
    bootNonce,
    mapSdkMessages,
    recordBranchMessages,
  ]);

  const loadEarlierMessages = useCallback(async () => {
    const q = historyQueryRef.current;
    if (!q || !q.hasNext || loadingMoreHistory) return;
    setLoadingMoreHistory(true);
    try {
      const res = await q.loadNextPage();
      if (res.isOk && res.data?.data) {
        const mapped = mapSdkMessages(res.data.data, connectedUserId);
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const item of mapped) {
            byId.set(item.id, item);
          }
          return Array.from(byId.values()).sort((a, b) => a.sentTime - b.sentTime);
        });
        setHasMoreHistory(q.hasNext);
      }
    } finally {
      setLoadingMoreHistory(false);
    }
  }, [connectedUserId, loadingMoreHistory, mapSdkMessages]);

  const sendTextMessage = useCallback(
    async (rawText: string, branchKey: string | null): Promise<boolean> => {
      const trimmed = rawText.trim();
      if (!trimmed || sdkState !== 'connected' || sending) return false;

      if (branchKey) {
        lastOutboundBranchRef.current = branchKey;
      }

      setSending(true);
      setSendError('');
      const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();

      recordBranchMessages([tempId], branchKey);

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          senderUserId: connectedUserId,
          isMine: true,
          text: trimmed,
          sentTime: now,
          status: 'sending',
        },
      ]);

      try {
        const channel = new DirectChannel(supportTargetId);
        const res = await channel.sendMessage(new SendTextMessageParams({ text: trimmed }));
        if (!res.isOk || !res.data) {
          throw new Error(`Message failed to send (code ${res.code}).`);
        }

        const confirmed = res.data;
        const confirmedId = confirmed.messageId || tempId;
        recordBranchMessages([confirmedId], branchKey);

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempId);
          const next: NexconnUiMessage = {
            id: confirmedId,
            senderUserId: confirmed.senderUserId || connectedUserId,
            isMine: true,
            text: trimmed,
            sentTime: confirmed.sentTime || now,
            status: 'sent',
          };
          const deduped = new Map(filtered.map((m) => [m.id, m]));
          deduped.set(confirmedId, next);
          return Array.from(deduped.values()).sort((a, b) => a.sentTime - b.sentTime);
        });
        return true;
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
        setSendError(err instanceof Error ? err.message : 'Unable to send message right now.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [connectedUserId, recordBranchMessages, sdkState, sending, supportTargetId]
  );

  const retryConnection = useCallback(() => {
    setBootNonce((n) => n + 1);
  }, []);

  return {
    sdkState,
    statusData,
    sdkError,
    supportTargetId,
    connectedUserId,
    messages,
    branchOwnership,
    hasMoreHistory,
    loadingMoreHistory,
    sending,
    sendError,
    unreadCount,
    clearDeskUnread,
    loadEarlierMessages,
    sendTextMessage,
    retryConnection,
    setSendError,
  };
}
