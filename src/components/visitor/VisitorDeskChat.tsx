import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUp,
  Building2,
  CheckCheck,
  Clock,
  KeyRound,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Ticket as TicketIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Announcement,
  QueueFeedItem,
  ServiceLocation,
  SupportMessage,
  SupportThread,
  Ticket,
  TicketPositionInfo,
} from '../../types/queue';
import { VisitorBranchItem, findBranchForServiceId } from './branchCatalog';
import {
  BranchConversationMeta,
  DeskSystemEvent,
  VisitorThemeMode,
} from './types';
import { NexconnSdkState, NexconnStatusResponse, NexconnUiMessage } from './useVisitorNexconn';
import { VisitorLiveQueuePanel } from './VisitorLiveQueuePanel';

interface VisitorDeskChatProps {
  visitorTheme: VisitorThemeMode;
  displayName: string;
  activeVisitorUid: string | null;
  branches: VisitorBranchItem[];
  activeTickets: Ticket[];
  allMyTickets: Ticket[];
  services: ServiceLocation[];
  queueFeed: QueueFeedItem[];
  announcements: Announcement[];
  getTicketPosition: (ticketId: string) => TicketPositionInfo | null;
  onLeaveQueue: (ticketId: string) => Promise<void>;
  activeBranchKey: string | null;
  branchSessions: Record<string, BranchConversationMeta>;
  onSelectBranchSession: (meta: {
    branchKey: string;
    locationName: string;
    categoryId?: string;
    serviceId?: string;
    serviceName?: string;
    ticketId?: string;
    ticketNumber?: string;
  }) => void;
  onClearSelectedBranch: () => void;
  onMarkBranchFirstTaggedSent: (branchKey: string) => void;
  draftByBranch: Record<string, string>;
  onSetDraftForBranch: (branchKey: string, text: string) => void;
  systemEvents: DeskSystemEvent[];
  onSwitchToQueueAI: () => void;
  // Real Nexconn state from VisitorView
  nexconnState: {
    sdkState: NexconnSdkState;
    statusData: NexconnStatusResponse | null;
    sdkError: string;
    supportTargetId: string;
    messages: NexconnUiMessage[];
    branchOwnership: Record<string, string>;
    hasMoreHistory: boolean;
    loadingMoreHistory: boolean;
    sending: boolean;
    sendError: string;
    loadEarlierMessages: () => Promise<void>;
    sendTextMessage: (rawText: string, branchKey: string | null) => Promise<boolean>;
    retryConnection: () => void;
  };
  // Branch chat relay synced with Staff Workspace Queue & Desk Chat
  branchMessages: SupportMessage[];
  onRelayBranchMessage: (params: {
    branchKey: string;
    locationName: string;
    serviceId?: string | null;
    serviceName?: string | null;
    ticket?: Ticket | null;
    text: string;
  }) => void;
  // Existing QDesk fallback if Nexconn env keys are absent
  supportThreads: SupportThread[];
  createSupportThread: (
    serviceId: string | null,
    subject: string,
    messageText: string
  ) => Promise<string | null>;
  sendSupportMessage: (threadId: string, text: string) => Promise<void>;
  subscribeToThreadMessages: (
    threadId: string,
    onMessages: (msgs: SupportMessage[]) => void
  ) => () => void;
}

function formatMessageTime(ts: number): string {
  if (!ts || ts <= 0) return '';
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VisitorDeskChat({
  visitorTheme,
  displayName,
  activeVisitorUid,
  branches,
  activeTickets,
  allMyTickets,
  services,
  queueFeed,
  announcements,
  getTicketPosition,
  onLeaveQueue,
  activeBranchKey,
  branchSessions,
  onSelectBranchSession,
  onClearSelectedBranch,
  onMarkBranchFirstTaggedSent,
  draftByBranch,
  onSetDraftForBranch,
  systemEvents,
  onSwitchToQueueAI,
  nexconnState,
  branchMessages,
  onRelayBranchMessage,
  supportThreads,
  createSupportThread,
  sendSupportMessage,
  subscribeToThreadMessages,
}: VisitorDeskChatProps) {
  const isDark = visitorTheme === 'dark';
  const [findTicketInput, setFindTicketInput] = useState('');
  const [findTicketResult, setFindTicketResult] = useState<{
    found?: Ticket;
    message?: string;
  } | null>(null);
  const [showFindTicket, setShowFindTicket] = useState(false);
  const [previewServiceId, setPreviewServiceId] = useState<string | null>(null);
  const [useQdeskFallback, setUseQdeskFallback] = useState(false);
  const [qdeskMessages, setQdeskMessages] = useState<SupportMessage[]>([]);
  const [qdeskBusy, setQdeskBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const branchByKey = useMemo(
    () => new Map(branches.map((b) => [b.branchKey, b])),
    [branches]
  );

  const currentSession = activeBranchKey ? branchSessions[activeBranchKey] ?? null : null;
  const currentBranch = activeBranchKey ? branchByKey.get(activeBranchKey) ?? null : null;

  // Resolve attached ticket live from QueueContext tickets
  const attachedTicket = useMemo(() => {
    if (!currentSession?.ticketId) return null;
    return allMyTickets.find((t) => t.id === currentSession.ticketId) ?? null;
  }, [allMyTickets, currentSession?.ticketId]);

  const effectiveServiceId =
    attachedTicket?.serviceId ||
    currentSession?.serviceId ||
    previewServiceId ||
    currentBranch?.desks[0]?.serviceId ||
    null;

  useEffect(() => {
    setPreviewServiceId(null);
  }, [activeBranchKey]);

  // Active announcements for this branch
  const branchAnnouncements = useMemo(() => {
    if (!currentBranch) {
      return announcements.filter((a) => a.serviceId === 'all');
    }
    const deskIds = new Set(currentBranch.desks.map((d) => d.serviceId));
    return announcements.filter(
      (a) => a.serviceId === 'all' || deskIds.has(a.serviceId)
    );
  }, [announcements, currentBranch]);

  // Filter Nexconn messages for the currently selected branch conversation
  const visibleNexconnMessages = useMemo(() => {
    if (!activeBranchKey || !currentBranch) return [];
    const branchIds = new Set<string>();
    const hasAnyBranchMapping = Object.keys(nexconnState.branchOwnership).length > 0;
    const activeSessionKeys = Object.keys(branchSessions);

    for (const msg of nexconnState.messages) {
      const ownerBranch = nexconnState.branchOwnership[msg.id];
      if (ownerBranch) {
        if (ownerBranch === activeBranchKey) branchIds.add(msg.id);
      } else if (msg.text.startsWith(`[${currentBranch.locationName}`)) {
        branchIds.add(msg.id);
      } else if (!hasAnyBranchMapping && activeSessionKeys.length <= 1) {
        // Legacy untagged messages when visitor only has this branch thread
        const taggedOtherBranch = branches.some(
          (b) =>
            b.branchKey !== activeBranchKey &&
            msg.text.startsWith(`[${b.locationName}`)
        );
        if (!taggedOtherBranch) {
          branchIds.add(msg.id);
        }
      }
    }
    return nexconnState.messages.filter((m) => branchIds.has(m.id));
  }, [
    activeBranchKey,
    branchSessions,
    branches,
    currentBranch,
    nexconnState.branchOwnership,
    nexconnState.messages,
  ]);

  // Interleave chronological timeline of Nexconn messages, staff branch replies & system turn updates
  const timelineItems = useMemo(() => {
    const eventsForBranch = systemEvents.filter(
      (evt) =>
        evt.branchKey === activeBranchKey ||
        (attachedTicket && evt.ticketId === attachedTicket.id)
    );

    const extraStaffReplies: NexconnUiMessage[] = branchMessages
      .filter((bm) => bm.senderRole === 'staff')
      .filter(
        (bm) =>
          !visibleNexconnMessages.some(
            (nm) =>
              !nm.isMine &&
              nm.text.trim() === bm.text.trim() &&
              Math.abs(nm.sentTime - bm.createdAt) < 120000
          )
      )
      .map((bm) => ({
        id: `relay_${bm.id}`,
        senderUserId: bm.senderUid,
        isMine: false,
        text: bm.text,
        sentTime: bm.createdAt,
        status: 'sent' as const,
      }));

    type TimelineEntry =
      | { kind: 'msg'; ts: number; data: NexconnUiMessage }
      | { kind: 'sys'; ts: number; data: DeskSystemEvent };

    const entries: TimelineEntry[] = [
      ...visibleNexconnMessages.map((m) => ({
        kind: 'msg' as const,
        ts: m.sentTime,
        data: m,
      })),
      ...extraStaffReplies.map((m) => ({
        kind: 'msg' as const,
        ts: m.sentTime,
        data: m,
      })),
      ...eventsForBranch.map((e) => ({
        kind: 'sys' as const,
        ts: e.timestamp,
        data: e,
      })),
    ];

    return entries.sort((a, b) => a.ts - b.ts);
  }, [activeBranchKey, attachedTicket, branchMessages, systemEvents, visibleNexconnMessages]);

  // QDesk fallback matching thread for current branch
  const matchingQdeskThread = useMemo(() => {
    if (!currentBranch) return supportThreads[0] ?? null;
    const deskIds = new Set(currentBranch.desks.map((d) => d.serviceId));
    return (
      supportThreads.find((t) => t.serviceId && deskIds.has(t.serviceId)) ??
      supportThreads.find((t) =>
        t.subject.toLowerCase().includes(currentBranch.locationName.toLowerCase())
      ) ??
      null
    );
  }, [currentBranch, supportThreads]);

  useEffect(() => {
    if (!useQdeskFallback || !matchingQdeskThread) {
      setQdeskMessages([]);
      return;
    }
    return subscribeToThreadMessages(matchingQdeskThread.id, setQdeskMessages);
  }, [useQdeskFallback, matchingQdeskThread, subscribeToThreadMessages]);

  const combinedLocalMessages = useMemo(() => {
    const merged = [...branchMessages];
    for (const qm of qdeskMessages) {
      const dup = merged.some(
        (m) => m.text === qm.text && Math.abs(m.createdAt - qm.createdAt) < 5000
      );
      if (!dup) merged.push(qm);
    }
    return merged.sort((a, b) => a.createdAt - b.createdAt);
  }, [branchMessages, qdeskMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineItems.length, combinedLocalMessages.length, activeBranchKey]);

  const draft = activeBranchKey ? draftByBranch[activeBranchKey] ?? '' : '';

  const handleFindTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = findTicketInput.trim().toUpperCase();
    if (!code) {
      setFindTicketResult({ message: 'Enter your ticket number (for example: B-106).' });
      return;
    }

    const mine = allMyTickets.find((t) => t.ticketNumber.toUpperCase() === code);
    if (mine) {
      const matched = findBranchForServiceId(branches, mine.serviceId);
      setFindTicketResult({ found: mine });
      if (matched) {
        onSelectBranchSession({
          branchKey: matched.branch.branchKey,
          locationName: matched.branch.locationName,
          categoryId: matched.branch.categoryId,
          serviceId: matched.desk.serviceId,
          serviceName: matched.desk.name,
          ticketId: mine.id,
          ticketNumber: mine.ticketNumber,
        });
      }
      return;
    }

    // Check public feed solely to give an accurate message (never grant private chat to another user's ticket!)
    const publicMatch = queueFeed.find((f) => f.ticketNumber.toUpperCase() === code);
    if (publicMatch) {
      setFindTicketResult({
        message: `Ticket ${code} is not linked to this signed-in visitor account (it may be a walk-in or booked under another account). Select the branch below to ask staff.`,
      });
    } else {
      setFindTicketResult({
        message: `No ticket matching "${code}" was found on your account.`,
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchKey || !currentBranch || !draft.trim()) return;

    const rawText = draft.trim();
    const relayPayload = {
      branchKey: activeBranchKey,
      locationName: currentBranch.locationName,
      serviceId: effectiveServiceId,
      serviceName: currentSession?.serviceName || currentBranch.desks[0]?.name || 'Bank Desk',
      ticket: attachedTicket,
      text: rawText,
    };

    if (useQdeskFallback || nexconnState.sdkState === 'unconfigured') {
      if (qdeskBusy) return;
      setQdeskBusy(true);
      onSetDraftForBranch(activeBranchKey, '');
      try {
        onRelayBranchMessage(relayPayload);
        if (matchingQdeskThread) {
          await sendSupportMessage(matchingQdeskThread.id, rawText);
        } else {
          const subj = attachedTicket
            ? `Ticket ${attachedTicket.ticketNumber} · ${currentBranch.locationName}`
            : `Pre-booking inquiry · ${currentBranch.locationName}`;
          await createSupportThread(effectiveServiceId, subj, rawText);
        }
      } finally {
        setQdeskBusy(false);
      }
      return;
    }

    // Tag the very first message of a branch session so staff in LINELESS Support Inbox immediately see which branch / ticket it pertains to
    let payloadText = rawText;
    if (currentSession && !currentSession.firstTaggedSent) {
      const ctxParts = [
        currentSession.locationName,
        currentSession.serviceName || null,
        attachedTicket ? `Ticket ${attachedTicket.ticketNumber}` : 'Pre-booking inquiry',
      ].filter(Boolean);
      payloadText = `[${ctxParts.join(' · ')}]\n${rawText}`;
    }

    onSetDraftForBranch(activeBranchKey, '');
    const sent = await nexconnState.sendTextMessage(payloadText, activeBranchKey);
    if (sent) {
      onRelayBranchMessage(relayPayload);
      if (currentSession && !currentSession.firstTaggedSent) {
        onMarkBranchFirstTaggedSent(activeBranchKey);
      }
    } else {
      // Restore draft if send failed
      onSetDraftForBranch(activeBranchKey, rawText);
    }
  };

  // =========================================================================
  // PICKER STATE (when no branch conversation is currently selected)
  // =========================================================================
  if (!activeBranchKey || !currentBranch) {
    const liveBranches = branches.filter((b) => b.desks.some((d) => d.isLive || d.canBook));
    const displayBranches = liveBranches.length > 0 ? liveBranches : branches.slice(0, 8);

    return (
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {activeTickets.length > 1 ? (
            <div className="space-y-3">
              <h2
                className={`font-display text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-[#10281B]'
                }`}
              >
                Choose an active ticket to chat about
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                You have {activeTickets.length} active tickets. Select one to open Desk Chat and its live queue.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeTickets.map((ticket) => {
                  const matched = findBranchForServiceId(branches, ticket.serviceId);
                  const branchName = matched?.branch.locationName || 'Bank Branch';
                  const deskName = matched?.desk.name || ticket.serviceId;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        if (matched) {
                          onSelectBranchSession({
                            branchKey: matched.branch.branchKey,
                            locationName: matched.branch.locationName,
                            categoryId: matched.branch.categoryId,
                            serviceId: matched.desk.serviceId,
                            serviceName: matched.desk.name,
                            ticketId: ticket.id,
                            ticketNumber: ticket.ticketNumber,
                          });
                        }
                      }}
                      className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors ${
                        isDark
                          ? 'border-[#1E3628] bg-[#0D1C13] hover:border-[#348F59]'
                          : 'border-[#DCD9CD] bg-white hover:border-[#8ACBA4] hover:bg-[#F3FAF6]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className={`font-mono-tabular text-lg font-bold ${
                            isDark ? 'text-white' : 'text-[#10281B]'
                          }`}
                        >
                          {ticket.ticketNumber}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            isDark
                              ? 'bg-[#153924] text-[#8CE2AE]'
                              : 'bg-[#E2F4E9] text-[#103823]'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          isDark ? 'text-[#EEF5F0]' : 'text-[#11281B]'
                        }`}
                      >
                        {deskName}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                        {branchName}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2
              className={`font-display text-xl font-semibold ${
                isDark ? 'text-white' : 'text-[#10281B]'
              }`}
            >
              {activeTickets.length > 1 ? 'Or ask another branch' : 'Choose a branch to message'}
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
              Message any branch desk directly for pre-booking questions, or attach an existing ticket.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {displayBranches.map((branch) => {
                const openCount = branch.desks.filter((d) => !d.isPaused && d.isLive).length;
                return (
                  <button
                    key={branch.branchKey}
                    type="button"
                    onClick={() =>
                      onSelectBranchSession({
                        branchKey: branch.branchKey,
                        locationName: branch.locationName,
                        categoryId: branch.categoryId,
                        serviceId: branch.desks[0]?.serviceId,
                        serviceName: branch.desks[0]?.name,
                      })
                    }
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      isDark
                        ? 'border-[#1B3324] bg-[#0D1C13] hover:border-[#348F59]'
                        : 'border-[#E2DFD3] bg-white hover:border-[#8ACBA4] hover:bg-[#F3FAF6]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isDark
                          ? 'bg-[#142D1E] text-[#8CE2AE]'
                          : 'bg-[#E5F6EC] text-[#18603B]'
                      }`}
                    >
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-[#10281B]'
                        }`}
                      >
                        {branch.locationName}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                        }`}
                      >
                        {branch.desks.length} {branch.desks.length === 1 ? 'desk' : 'desks'}
                        {openCount > 0 ? ` · ${openCount} open` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recovery Option: Find My Ticket / Join a Queue */}
          <div
            className={`space-y-3 rounded-2xl border p-4 ${
              isDark ? 'border-[#1B3324] bg-[#0B1710]' : 'border-[#E2DFD3] bg-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowFindTicket((p) => !p)}
                className={`inline-flex items-center gap-2 text-xs font-semibold ${
                  isDark ? 'text-[#8CE2AE]' : 'text-[#1B4332]'
                }`}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Find my ticket</span>
              </button>

              <button
                type="button"
                onClick={onSwitchToQueueAI}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  isDark ? 'text-[#CBE0D3] hover:text-white' : 'text-[#3B5245] hover:text-[#10281B]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Join a queue with Queue AI</span>
              </button>
            </div>

            {showFindTicket && (
              <form onSubmit={handleFindTicketSubmit} className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={findTicketInput}
                    onChange={(e) => setFindTicketInput(e.target.value)}
                    placeholder="Enter ticket number (e.g. B-106)"
                    className={`font-mono-tabular min-h-[38px] flex-1 rounded-xl border px-3 text-xs uppercase focus:outline-none ${
                      isDark
                        ? 'border-[#1E3628] bg-[#08130C] text-white'
                        : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#11281B]'
                    }`}
                  />
                  <button
                    type="submit"
                    className={`min-h-[38px] rounded-xl px-4 text-xs font-semibold ${
                      isDark
                        ? 'bg-[#73E8A4] text-[#052110]'
                        : 'bg-[#1B4332] text-white'
                    }`}
                  >
                    Find
                  </button>
                </div>
                {findTicketResult?.message && (
                  <p className={`text-xs ${isDark ? 'text-[#FCA5A5]' : 'text-[#546E5F]'}`}>
                    {findTicketResult.message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE DESK CHAT + LIVE QUEUE PANEL SPLIT VIEW
  // =========================================================================
  const showQdeskThreadView = useQdeskFallback || nexconnState.sdkState === 'unconfigured';

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Main Desk Chat Column */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile Collapsible Live Queue Above Desk Chat */}
        <div className="lg:hidden">
          <VisitorLiveQueuePanel
            variant="mobile"
            visitorTheme={visitorTheme}
            branch={currentBranch}
            activeServiceId={effectiveServiceId}
            onSelectPreviewService={setPreviewServiceId}
            attachedTicket={attachedTicket}
            services={services}
            queueFeed={queueFeed}
            getTicketPosition={getTicketPosition}
            onLeaveQueue={onLeaveQueue}
          />
        </div>

        {/* Desk Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 ${
            isDark ? 'border-[#172B1E] bg-[#08130C]' : 'border-[#E3E0D4] bg-white'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isDark ? 'bg-[#142D1E] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
              }`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={`font-display truncate text-sm font-bold ${
                    isDark ? 'text-white' : 'text-[#10281B]'
                  }`}
                >
                  {currentBranch.locationName}
                </h2>
                {attachedTicket ? (
                  <span
                    className={`font-mono-tabular inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      isDark
                        ? 'bg-[#153924] text-[#8CE2AE]'
                        : 'bg-[#E2F4E9] text-[#103823]'
                    }`}
                  >
                    <TicketIcon className="h-3 w-3" aria-hidden="true" />
                    {attachedTicket.ticketNumber} · {attachedTicket.status}
                  </span>
                ) : (
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      isDark
                        ? 'bg-[#13251A] text-[#9AB5A4]'
                        : 'bg-[#F2F0E8] text-[#546E5F]'
                    }`}
                  >
                    Pre-booking inquiry
                  </span>
                )}
              </div>
              <p className={`truncate text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                {currentSession?.serviceName || currentBranch.desks[0]?.name || 'Service Desk'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {nexconnState.sdkState === 'connected' && !useQdeskFallback ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  isDark ? 'bg-[#122D1D] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
                }`}
              >
                <Wifi className="h-3 w-3" aria-hidden="true" />
                <span>Live</span>
              </span>
            ) : nexconnState.sdkState === 'checking' ||
              nexconnState.sdkState === 'connecting' ||
              nexconnState.sdkState === 'reconnecting' ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  isDark ? 'bg-[#132319] text-[#96B0A0]' : 'bg-[#F2F0E8] text-[#546E5F]'
                }`}
              >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                <span>Connecting...</span>
              </span>
            ) : nexconnState.sdkState === 'error' && !useQdeskFallback ? (
              <button
                type="button"
                onClick={nexconnState.retryConnection}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                  isDark
                    ? 'border-[#233F2D] text-[#D5E6DC]'
                    : 'border-[#DCD9CD] text-[#10281B]'
                }`}
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Retry</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClearSelectedBranch}
              title="Switch branch or ticket"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                isDark
                  ? 'border-[#1E3628] text-[#CBE0D3] hover:bg-[#13251A]'
                  : 'border-[#DCD9CD] bg-[#FAF9F5] text-[#3B5245] hover:bg-[#EFECE3]'
              }`}
            >
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Switch</span>
            </button>
          </div>
        </div>

        {/* Slim Branch Announcements Banner Above Desk Chat */}
        {branchAnnouncements.length > 0 && (
          <div
            role="region"
            aria-label="Branch announcements"
            className={`border-b px-4 py-2.5 text-xs sm:px-6 ${
              isDark
                ? 'border-[#2C4220] bg-[#132010] text-[#D9F4B8]'
                : 'border-[#C6DFCB] bg-[#EDF7F0] text-[#144329]'
            }`}
          >
            <div className="flex items-start gap-2">
              <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <div className="space-y-0.5">
                {branchAnnouncements.map((ann) => (
                  <p key={ann.id}>
                    <strong className="font-semibold">
                      {ann.serviceId === 'all' ? 'All Desks' : currentBranch.locationName}:
                    </strong>{' '}
                    {ann.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages Viewport */}
        {showQdeskThreadView ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {nexconnState.sdkState === 'unconfigured' && (
              <div
                className={`border-b px-4 py-2.5 text-xs sm:px-6 ${
                  isDark
                    ? 'border-[#1B3324] bg-[#0B1710] text-[#9AB5A4]'
                    : 'border-[#E3E0D4] bg-[#FAF8F2] text-[#4B6356]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Branch desk messaging is connected directly to {currentBranch.locationName} staff.
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
              {systemEvents
                .filter(
                  (evt) =>
                    evt.branchKey === activeBranchKey ||
                    (attachedTicket && evt.ticketId === attachedTicket.id)
                )
                .map((evt) => (
                  <div key={evt.id} className="flex justify-center">
                    <div
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
                        isDark
                          ? 'border-[#2F754A] bg-[#143521] text-[#8CE2AE]'
                          : 'border-[#9AD2B0] bg-[#E2F4E9] text-[#103823]'
                      }`}
                    >
                      {evt.text}
                    </div>
                  </div>
                ))}

              {combinedLocalMessages.length === 0 ? (
                <div className="py-10 text-center">
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#10281B]'}`}>
                    Message {currentBranch.locationName}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                    Ask about required documents, counter availability, or your ticket.
                  </p>
                </div>
              ) : (
                combinedLocalMessages.map((m) => {
                  const isMine =
                    m.senderRole === 'visitor' &&
                    (m.senderUid === activeVisitorUid || m.senderUid === 'demo_visitor_local');
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <span
                        className={`mb-1 text-[11px] font-medium ${
                          isDark ? 'text-[#86A090]' : 'text-[#5B7063]'
                        }`}
                      >
                        {isMine ? displayName : m.senderName} · {formatMessageTime(m.createdAt)}
                      </span>
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%] ${
                          isMine
                            ? 'rounded-br-sm bg-[#1B4332] text-white'
                            : isDark
                            ? 'rounded-bl-sm border border-[#1B3324] bg-[#0D1C13] text-[#EEF5F0]'
                            : 'rounded-bl-sm border border-[#E2DFD3] bg-white text-[#11281B]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : nexconnState.sdkState === 'error' ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div
              className={`max-w-md space-y-3 rounded-2xl border p-5 text-sm ${
                isDark
                  ? 'border-[#7F1D1D] bg-[#241010] text-[#FCA5A5]'
                  : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold">Unable to connect to Nexconn Live Chat</p>
                  <p className="text-xs opacity-90">{nexconnState.sdkError}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={nexconnState.retryConnection}
                  className="rounded-xl bg-[#991B1B] px-3.5 py-2 text-xs font-semibold text-white"
                >
                  Retry Connection
                </button>
                <button
                  type="button"
                  onClick={() => setUseQdeskFallback(true)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                    isDark
                      ? 'border-[#7F1D1D] bg-[#160A0A] text-[#FCA5A5]'
                      : 'border-[#FECACA] bg-white text-[#991B1B]'
                  }`}
                >
                  Use QDesk Thread
                </button>
              </div>
            </div>
          </div>
        ) : nexconnState.sdkState === 'checking' || nexconnState.sdkState === 'connecting' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
            <Loader2
              className={`h-6 w-6 animate-spin ${isDark ? 'text-[#8CE2AE]' : 'text-[#1B4332]'}`}
              aria-hidden="true"
            />
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#10281B]'}`}>
              Connecting to {currentBranch.locationName}...
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {nexconnState.hasMoreHistory && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={nexconnState.loadingMoreHistory}
                  onClick={() => void nexconnState.loadEarlierMessages()}
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    isDark
                      ? 'border-[#1E3628] bg-[#0D1C13] text-[#CBE0D3]'
                      : 'border-[#DCD9CD] bg-white text-[#11281B]'
                  }`}
                >
                  {nexconnState.loadingMoreHistory ? 'Loading...' : 'Load earlier messages'}
                </button>
              </div>
            )}

            {timelineItems.length === 0 ? (
              <div className="mx-auto max-w-md py-10 text-center">
                <p className={`font-display text-base font-semibold ${isDark ? 'text-white' : 'text-[#10281B]'}`}>
                  Connected to {currentBranch.locationName}
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                  {attachedTicket
                    ? `Your ticket ${attachedTicket.ticketNumber} is attached. Send a message to reach the desk directly.`
                    : 'Send a message to ask about documents, timing, or desk availability before booking.'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {(attachedTicket
                    ? [
                        `Hi, I have ticket ${attachedTicket.ticketNumber} — quick question about my wait.`,
                        'Can I request priority accessibility support?',
                      ]
                    : [
                        'What documents should I bring with me today?',
                        'Are all counters currently open with no scheduled break?',
                      ]
                  ).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSetDraftForBranch(activeBranchKey, suggestion)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        isDark
                          ? 'border-[#1E3628] bg-[#0D1C13] text-[#CBE0D3] hover:border-[#348F59]'
                          : 'border-[#DCD9CD] bg-white text-[#143322] hover:border-[#8ACBA4] hover:bg-[#F3FAF6]'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              timelineItems.map((entry) => {
                if (entry.kind === 'sys') {
                  return (
                    <div key={entry.data.id} className="flex justify-center">
                      <div
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
                          isDark
                            ? 'border-[#2F754A] bg-[#143521] text-[#8CE2AE]'
                            : 'border-[#9AD2B0] bg-[#E2F4E9] text-[#103823]'
                        }`}
                      >
                        {entry.data.text}
                      </div>
                    </div>
                  );
                }

                const msg = entry.data;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}
                  >
                    <span
                      className={`mb-1 text-[11px] font-medium ${
                        isDark ? 'text-[#86A090]' : 'text-[#5B7063]'
                      }`}
                    >
                      {msg.isMine ? displayName : `${currentBranch.locationName} Desk`}
                      {msg.sentTime ? ` · ${formatMessageTime(msg.sentTime)}` : ''}
                    </span>
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[72%] ${
                        msg.isMine
                          ? 'rounded-br-sm bg-[#1B4332] text-white'
                          : isDark
                          ? 'rounded-bl-sm border border-[#1B3324] bg-[#0D1C13] text-[#EEF5F0]'
                          : 'rounded-bl-sm border border-[#E2DFD3] bg-white text-[#11281B]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      {msg.isMine && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                          {msg.status === 'sending' ? (
                            <>
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span>Sending</span>
                            </>
                          ) : msg.status === 'failed' ? (
                            <span className="text-[#FCA5A5]">Failed to send</span>
                          ) : (
                            <>
                              <CheckCheck className="h-3 w-3" aria-hidden="true" />
                              <span>Sent</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {nexconnState.sendError && !showQdeskThreadView && (
          <div
            className={`flex items-center gap-2 border-t px-4 py-2 text-xs ${
              isDark
                ? 'border-[#7F1D1D] bg-[#241010] text-[#FCA5A5]'
                : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{nexconnState.sendError}</span>
          </div>
        )}

        {/* Bottom-Anchored Message Composer */}
        <div
          className={`border-t px-4 py-3 sm:px-6 ${
            isDark ? 'border-[#172B1E] bg-[#08130C]' : 'border-[#E3E0D4] bg-white'
          }`}
        >
          <form
            onSubmit={(e) => void handleSend(e)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-1.5 ${
              isDark
                ? 'border-[#1E3628] bg-[#0B1710] focus-within:border-[#348F59]'
                : 'border-[#DCD9CD] bg-[#FAF9F5] focus-within:border-[#1B4332]'
            }`}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => onSetDraftForBranch(activeBranchKey, e.target.value)}
              placeholder={`Message ${currentBranch.locationName}...`}
              maxLength={2000}
              aria-label={`Message ${currentBranch.locationName}`}
              className={`min-h-[40px] flex-1 bg-transparent text-sm focus:outline-none ${
                isDark
                  ? 'text-white placeholder:text-[#6B8575]'
                  : 'text-[#11281B] placeholder:text-[#6D8275]'
              }`}
            />
            <button
              type="submit"
              disabled={
                !draft.trim() ||
                qdeskBusy ||
                (!showQdeskThreadView &&
                  (nexconnState.sending || nexconnState.sdkState !== 'connected'))
              }
              aria-label="Send message"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
                isDark
                  ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                  : 'bg-[#1B4332] text-white hover:bg-[#143627]'
              }`}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      {/* Desktop Narrow Right-Hand Live Queue Panel */}
      <VisitorLiveQueuePanel
        variant="desktop"
        visitorTheme={visitorTheme}
        branch={currentBranch}
        activeServiceId={effectiveServiceId}
        onSelectPreviewService={setPreviewServiceId}
        attachedTicket={attachedTicket}
        services={services}
        queueFeed={queueFeed}
        getTicketPosition={getTicketPosition}
        onLeaveQueue={onLeaveQueue}
      />
    </div>
  );
}
