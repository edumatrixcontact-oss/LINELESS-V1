import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaCode,
  ConnectionStatus,
  ConnectionStatusHandler,
  DirectChannel,
  LogLevel,
  Message,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
} from '@nexconn/chat';
import { User } from 'firebase/auth';

export type StaffNexconnState =
  | 'idle'
  | 'checking'
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface StaffIncomingNexconnMessage {
  id: string;
  senderUserId: string;
  text: string;
  sentTime: number;
}

interface UseStaffNexconnParams {
  enabled: boolean;
  firebaseUser: User | null;
  isDemoStaff: boolean;
  staffDisplayName: string;
  onIncomingVisitorMessage?: (msg: StaffIncomingNexconnMessage) => void;
}

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
  return '';
}

export function useStaffNexconn({
  enabled,
  firebaseUser,
  isDemoStaff,
  staffDisplayName,
  onIncomingVisitorMessage,
}: UseStaffNexconnParams) {
  const envClientAppKey =
    (import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined)?.trim() || '';

  const [sdkState, setSdkState] = useState<StaffNexconnState>('idle');
  const [sdkError, setSdkError] = useState('');
  const [connectedUserId, setConnectedUserId] = useState('');
  const [bootNonce, setBootNonce] = useState(0);

  const onIncomingRef = useRef(onIncomingVisitorMessage);
  onIncomingRef.current = onIncomingVisitorMessage;

  useEffect(() => {
    if (!enabled) {
      setSdkState('idle');
      return;
    }

    let cancelled = false;
    const handlerId = `lineless_staff_desk_${Date.now()}`;

    async function boot() {
      setSdkState('checking');
      setSdkError('');

      try {
        const statusRes = await fetch('/api/nexconn/status');
        if (!statusRes.ok) {
          setSdkState('unconfigured');
          return;
        }
        const statusJson = (await statusRes.json()) as {
          configured?: boolean;
          serverConfigured?: boolean;
          appKey?: string;
        };
        if (cancelled) return;

        const appKey = envClientAppKey || statusJson.appKey || '';
        if (!appKey || !statusJson.serverConfigured) {
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
            mode: 'staff',
            name: staffDisplayName,
            isDemoStaff,
          }),
        });

        const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
          configured?: boolean;
          token?: string;
          userId?: string;
          error?: string;
        };
        if (cancelled) return;

        if (!tokenRes.ok || !tokenJson.token) {
          if (tokenJson.configured === false) {
            setSdkState('unconfigured');
            return;
          }
          throw new Error(tokenJson.error || 'Unable to connect staff live chat.');
        }

        const areaCode = resolveAreaCodeFromToken(tokenJson.token);
        try {
          await NCEngine.disconnect().catch(() => {});
          NCEngine.initialize({
            appKey,
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

        NCEngine.addMessageHandler(
          handlerId,
          new MessageHandler({
            onMessageReceived: ({ messages: incoming }) => {
              if (cancelled || !incoming?.length) return;
              for (const rawMsg of incoming) {
                if (rawMsg.senderUserId === myUid) continue;
                const text = extractMessageText(rawMsg);
                if (!text) continue;
                onIncomingRef.current?.({
                  id: rawMsg.messageId || `${rawMsg.senderUserId}_${rawMsg.sentTime}`,
                  senderUserId: rawMsg.senderUserId,
                  text,
                  sentTime: rawMsg.sentTime || Date.now(),
                });
              }
            },
          })
        );

        if (!cancelled) {
          setSdkState('connected');
        }
      } catch (err) {
        if (cancelled) return;
        setSdkError(
          err instanceof Error ? err.message : 'Unable to connect staff live messaging.'
        );
        setSdkState('error');
      }
    }

    void boot();

    return () => {
      cancelled = true;
      NCEngine.removeMessageHandler(handlerId);
      NCEngine.removeConnectionStatusHandler(handlerId);
      void NCEngine.disconnect().catch(() => {});
    };
  }, [enabled, envClientAppKey, firebaseUser, isDemoStaff, staffDisplayName, bootNonce]);

  const directSend = useCallback(
    async (targetUserId: string, rawText: string): Promise<boolean> => {
      const clean = rawText.trim();
      if (!clean || sdkState !== 'connected' || !targetUserId) return false;
      try {
        const channel = new DirectChannel(targetUserId);
        const res = await channel.sendMessage(new SendTextMessageParams({ text: clean }));
        return res.isOk;
      } catch {
        return false;
      }
    },
    [sdkState]
  );

  const retryConnection = useCallback(() => {
    setBootNonce((n) => n + 1);
  }, []);

  return {
    sdkState,
    sdkError,
    connectedUserId,
    directSend,
    retryConnection,
  };
}
