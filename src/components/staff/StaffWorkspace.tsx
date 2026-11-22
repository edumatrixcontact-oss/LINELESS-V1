import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  Sun,
  Ticket as TicketIcon,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useQueue } from '../../context/QueueContext';
import { BankBranchCatalogItem } from '../../data/bankCatalog';
import { loadTicketBookingMetaMap } from '../../data/discoveryCatalog';
import {
  BranchChatThreadMeta,
  ThemeMode,
  Ticket,
} from '../../types/queue';
import { BankEmblem } from '../BankEmblem';
import { LinelessMark } from '../home/LinelessMark';
import { StaffAnnouncementOverlay } from './StaffAnnouncementOverlay';
import { StaffVisitHistory } from './StaffVisitHistory';
import {
  StaffIncomingNexconnMessage,
  useStaffNexconn,
} from './useStaffNexconn';

interface StaffWorkspaceProps {
  branch: BankBranchCatalogItem;
  staffTheme: ThemeMode;
  onToggleTheme: () => void;
  staffName: string;
  staffEmail: string;
  isDemoStaff: boolean;
  firebaseUser: User | null;
  onSwitchBranch: () => void;
  onBackToHomepage: () => void;
  onSignOut: () => void;
}

type StaffSection = 'queue' | 'history';
type LeftTab = 'queue' | 'messages';
type SelectedTarget =
  | { kind: 'ticket'; ticketId: string }
  | { kind: 'thread'; channelId: string }
  | null;

export function StaffWorkspace({
  branch,
  staffTheme,
  onToggleTheme,
  staffName,
  staffEmail,
  isDemoStaff,
  firebaseUser,
  onSwitchBranch,
  onBackToHomepage,
  onSignOut,
}: StaffWorkspaceProps) {
  const isDark = staffTheme === 'dark';

  const {
    services,
    tickets,
    announcements,
    branchChatThreads,
    callSpecificTicket,
    recallTicket,
    markServing,
    completeTicket,
    deferTicket,
    requeueTicket,
    toggleServicePause,
    sendAnnouncement,
    clearAnnouncement,
    upsertBranchChatThread,
    markBranchChatThreadRead,
    sendBranchChatMessage,
    getBranchChatMessages,
    resetDemoQueue,
  } = useQueue();

  const [activeSection, setActiveSection] = useState<StaffSection>('queue');
  const [leftTab, setLeftTab] = useState<LeftTab>('queue');
  const [activeDeskServiceId, setActiveDeskServiceId] = useState<string>(
    branch.desks[0]?.queueServiceId || ''
  );
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  // Counter confirmation state for primary "Call next" CTA
  const [callNextOpen, setCallNextOpen] = useState(false);
  const [chosenCallNextCounter, setChosenCallNextCounter] = useState<string>('');
  const [callSpecificCounter, setCallSpecificCounter] = useState<string>('');

  // Per-channel reply draft (preserved when opening overlays/tabs)
  const [replyDraftByChannel, setReplyDraftByChannel] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const menuRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveDeskServiceId(branch.desks[0]?.queueServiceId || '');
    setSelectedTarget(null);
    setCallNextOpen(false);
    setActionError('');
  }, [branch.id, branch.desks]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [accountMenuOpen]);

  const ticketMetaMap = useMemo(() => loadTicketBookingMetaMap(), []);

  const branchDeskIds = useMemo(
    () => new Set(branch.desks.map((d) => d.queueServiceId)),
    [branch.desks]
  );

  const selectedDesk = useMemo(
    () =>
      branch.desks.find((d) => d.queueServiceId === activeDeskServiceId) ||
      branch.desks[0],
    [branch.desks, activeDeskServiceId]
  );

  const liveSelectedService = useMemo(
    () => services.find((s) => s.id === selectedDesk?.queueServiceId),
    [services, selectedDesk]
  );
  const isDeskPaused = Boolean(liveSelectedService?.isPaused);

  // Strictly scoped to selected branch's desks
  const branchTickets = useMemo(
    () => tickets.filter((t) => branchDeskIds.has(t.serviceId)),
    [tickets, branchDeskIds]
  );

  const deskTickets = useMemo(
    () => branchTickets.filter((t) => t.serviceId === selectedDesk?.queueServiceId),
    [branchTickets, selectedDesk]
  );

  const nowServingTickets = useMemo(
    () =>
      deskTickets
        .filter((t) => t.status === 'called' || t.status === 'serving')
        .sort((a, b) => (b.calledAt ?? b.updatedAt) - (a.calledAt ?? a.updatedAt)),
    [deskTickets]
  );

  // Strict FIFO ascending by queueOrderAt
  const waitingTickets = useMemo(
    () =>
      deskTickets
        .filter((t) => t.status === 'waiting')
        .sort((a, b) => a.queueOrderAt - b.queueOrderAt),
    [deskTickets]
  );

  // Branch-scoped chat threads sorted unread first, then newest message
  const branchThreads = useMemo(() => {
    return branchChatThreads
      .filter((t) => t.branchKey === branch.id)
      .sort((a, b) => {
        const aUnread = a.unreadForStaff > 0 ? 1 : 0;
        const bUnread = b.unreadForStaff > 0 ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return b.lastMessageAt - a.lastMessageAt;
      });
  }, [branch.id, branchChatThreads]);

  const totalUnreadMessages = useMemo(
    () => branchThreads.reduce((acc, t) => acc + Math.max(0, t.unreadForStaff), 0),
    [branchThreads]
  );

  const branchAnnouncements = useMemo(
    () =>
      announcements.filter((a) => branchDeskIds.has(a.serviceId)),
    [announcements, branchDeskIds]
  );

  // Live Nexconn integration for authenticated live staff
  const handleIncomingNexconn = useCallback(
    (msg: StaffIncomingNexconnMessage) => {
      const strippedUid = msg.senderUserId.replace(/^ln_demo_/, '').replace(/^ln_/, '');
      const existingThread = branchThreads.find(
        (t) => t.visitorUid === strippedUid || t.visitorUid === msg.senderUserId
      );
      const matchingTicket = branchTickets.find(
        (t) =>
          (t.userId === strippedUid || t.userId === msg.senderUserId) &&
          (t.status === 'waiting' || t.status === 'called' || t.status === 'serving')
      );
      const channelId =
        existingThread?.channelId || `bchat_${strippedUid}::${branch.id}`;

      sendBranchChatMessage({
        channelId,
        threadOwnerUid: strippedUid,
        senderUid: strippedUid,
        senderRole: 'visitor',
        senderName: existingThread?.visitorName || matchingTicket?.visitorName || 'Visitor',
        text: msg.text,
      });

      upsertBranchChatThread({
        channelId,
        visitorUid: strippedUid,
        visitorName:
          existingThread?.visitorName || matchingTicket?.visitorName || 'Visitor',
        branchKey: branch.id,
        locationName: branch.displayName,
        serviceId: matchingTicket?.serviceId ?? existingThread?.serviceId ?? selectedDesk?.queueServiceId ?? null,
        serviceName:
          branch.desks.find((d) => d.queueServiceId === matchingTicket?.serviceId)?.name ??
          existingThread?.serviceName ??
          selectedDesk?.name ??
          null,
        ticketId: matchingTicket?.id ?? existingThread?.ticketId ?? null,
        ticketNumber: matchingTicket?.ticketNumber ?? existingThread?.ticketNumber ?? null,
        reason: matchingTicket?.reason ?? existingThread?.reason ?? null,
        unreadForStaffIncrement: 1,
        lastMessageText: msg.text,
        lastMessageAt: msg.sentTime,
      });
    },
    [
      branch.desks,
      branch.displayName,
      branch.id,
      branchThreads,
      branchTickets,
      selectedDesk,
      sendBranchChatMessage,
      upsertBranchChatThread,
    ]
  );

  const nexconn = useStaffNexconn({
    enabled: Boolean(firebaseUser || isDemoStaff),
    firebaseUser,
    isDemoStaff,
    staffDisplayName: `${branch.displayName} Desk`,
    onIncomingVisitorMessage: handleIncomingNexconn,
  });

  // Lookup helper for thread linked to a ticket
  const findThreadForTicket = useCallback(
    (ticket: Ticket): BranchChatThreadMeta | undefined => {
      return branchThreads.find(
        (t) =>
          t.ticketId === ticket.id ||
          (ticket.userId &&
            (t.channelId === `bchat_${ticket.userId}::${branch.id}` ||
              t.visitorUid === ticket.userId))
      );
    },
    [branch.id, branchThreads]
  );

  // Reason lookup across ticket, booking meta cache, and linked thread
  const resolveTicketReason = useCallback(
    (ticket: Ticket): string | undefined => {
      if (ticket.reason) return ticket.reason;
      const metaReason = ticketMetaMap[ticket.id]?.reason;
      if (metaReason) return metaReason;
      const thread = findThreadForTicket(ticket);
      return thread?.reason || undefined;
    },
    [findThreadForTicket, ticketMetaMap]
  );

  // Keep valid selection automatically when desk/tab updates
  useEffect(() => {
    if (selectedTarget?.kind === 'ticket') {
      const exists = deskTickets.some((t) => t.id === selectedTarget.ticketId);
      if (exists) return;
    } else if (selectedTarget?.kind === 'thread') {
      const exists = branchThreads.some((t) => t.channelId === selectedTarget.channelId);
      if (exists) return;
    }

    if (leftTab === 'queue') {
      const firstActive = nowServingTickets[0] || waitingTickets[0];
      if (firstActive) {
        setSelectedTarget({ kind: 'ticket', ticketId: firstActive.id });
      } else {
        setSelectedTarget(null);
      }
    } else if (branchThreads[0]) {
      setSelectedTarget({ kind: 'thread', channelId: branchThreads[0].channelId });
    } else {
      setSelectedTarget(null);
    }
  }, [
    branchThreads,
    deskTickets,
    leftTab,
    nowServingTickets,
    selectedTarget,
    waitingTickets,
  ]);

  const activeTicket: Ticket | null = useMemo(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.kind === 'ticket') {
      return branchTickets.find((t) => t.id === selectedTarget.ticketId) ?? null;
    }
    const thread = branchThreads.find((t) => t.channelId === selectedTarget.channelId);
    if (!thread) return null;
    if (thread.ticketId) {
      const direct = branchTickets.find((t) => t.id === thread.ticketId);
      if (direct) return direct;
    }
    return (
      branchTickets.find(
        (t) =>
          t.userId === thread.visitorUid &&
          (t.status === 'waiting' || t.status === 'called' || t.status === 'serving')
      ) ?? null
    );
  }, [branchThreads, branchTickets, selectedTarget]);

  const activeThread: BranchChatThreadMeta | null = useMemo(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.kind === 'thread') {
      return branchThreads.find((t) => t.channelId === selectedTarget.channelId) ?? null;
    }
    if (activeTicket) {
      return findThreadForTicket(activeTicket) ?? null;
    }
    return null;
  }, [activeTicket, branchThreads, findThreadForTicket, selectedTarget]);

  const activeChannelId = useMemo(() => {
    if (activeThread) return activeThread.channelId;
    if (activeTicket && activeTicket.userId) {
      return `bchat_${activeTicket.userId}::${branch.id}`;
    }
    return null;
  }, [activeThread, activeTicket, branch.id]);

  const activeChatMessages = useMemo(
    () => (activeChannelId ? getBranchChatMessages(activeChannelId) : []),
    [activeChannelId, getBranchChatMessages]
  );

  // Pick a free counter by default for Call Next / Call to Counter
  const availableCounters = useMemo(() => {
    const svcCounters = liveSelectedService?.counters;
    if (svcCounters && svcCounters.length > 0) return svcCounters;
    return selectedDesk?.counters || ['Counter 1'];
  }, [liveSelectedService, selectedDesk]);

  const recommendedCounter = useMemo(() => {
    const busy = new Set(
      nowServingTickets.map((t) => t.counter).filter((c): c is string => Boolean(c))
    );
    return availableCounters.find((c) => !busy.has(c)) || availableCounters[0] || 'Counter 1';
  }, [availableCounters, nowServingTickets]);

  useEffect(() => {
    setCallSpecificCounter(recommendedCounter);
  }, [recommendedCounter, activeTicket?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages.length, activeChannelId]);

  const handleSelectTicketRow = (ticket: Ticket) => {
    setSelectedTarget({ kind: 'ticket', ticketId: ticket.id });
    setActionError('');
    const linked = findThreadForTicket(ticket);
    if (linked && linked.unreadForStaff > 0) {
      markBranchChatThreadRead(linked.id);
    }
  };

  const handleSelectThreadRow = (thread: BranchChatThreadMeta) => {
    setSelectedTarget({ kind: 'thread', channelId: thread.channelId });
    setActionError('');
    if (thread.unreadForStaff > 0) {
      markBranchChatThreadRead(thread.id);
    }
  };

  const runSafeAction = async (key: string, fn: () => Promise<void>) => {
    if (busyAction) return;
    setActionError('');
    setBusyAction(key);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenCallNextConfirm = () => {
    if (waitingTickets.length === 0) return;
    setChosenCallNextCounter(recommendedCounter);
    setCallNextOpen(true);
  };

  const handleConfirmCallNext = async () => {
    const nextWaiting = waitingTickets[0];
    if (!nextWaiting) {
      setCallNextOpen(false);
      return;
    }
    const counter = chosenCallNextCounter || recommendedCounter;
    await runSafeAction('call_next', async () => {
      await callSpecificTicket(nextWaiting.id, counter);
      setCallNextOpen(false);
      setSelectedTarget({ kind: 'ticket', ticketId: nextWaiting.id });
    });
  };

  const handleSendStaffReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId) return;
    const draft = (replyDraftByChannel[activeChannelId] || '').trim();
    if (!draft) return;

    const ownerUid =
      activeThread?.visitorUid || activeTicket?.userId || activeChannelId;
    const visitorName =
      activeThread?.visitorName || activeTicket?.visitorName || 'Visitor';
    const serviceId =
      activeTicket?.serviceId ||
      activeThread?.serviceId ||
      selectedDesk?.queueServiceId ||
      null;
    const serviceName =
      branch.desks.find((d) => d.queueServiceId === serviceId)?.name ||
      activeThread?.serviceName ||
      selectedDesk?.name ||
      null;
    const ticketId = activeTicket?.id ?? activeThread?.ticketId ?? null;
    const ticketNumber = activeTicket?.ticketNumber ?? activeThread?.ticketNumber ?? null;
    const reason =
      (activeTicket ? resolveTicketReason(activeTicket) : activeThread?.reason) ?? null;

    setReplyDraftByChannel((prev) => ({ ...prev, [activeChannelId]: '' }));

    sendBranchChatMessage({
      channelId: activeChannelId,
      threadOwnerUid: ownerUid,
      senderUid: firebaseUser?.uid || 'demo_staff_local',
      senderRole: 'staff',
      senderName: `${branch.displayName} Desk`,
      text: draft,
    });

    upsertBranchChatThread({
      channelId: activeChannelId,
      visitorUid: ownerUid,
      visitorName,
      branchKey: branch.id,
      locationName: branch.displayName,
      serviceId,
      serviceName,
      ticketId,
      ticketNumber,
      reason,
      unreadForStaffIncrement: 0,
      lastMessageText: draft,
      lastMessageAt: Date.now(),
    });

    if (nexconn.sdkState === 'connected' && ownerUid) {
      const nexconnTarget = ownerUid.startsWith('ln_')
        ? ownerUid
        : isDemoStaff
        ? `ln_demo_${ownerUid}`
        : `ln_${ownerUid}`;
      void nexconn.directSend(nexconnTarget, draft);
    }
  };

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const waitingMinutes = (createdAt: number) =>
    Math.max(1, Math.round((Date.now() - createdAt) / 60_000));

  const isQrWalkInWithoutChat = Boolean(
    activeTicket &&
      activeTicket.channel === 'walk-in' &&
      !activeTicket.userId &&
      selectedTarget?.kind === 'ticket'
  );

  const initials =
    staffName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'S';

  const sidebarSurface = isDark
    ? 'bg-[#08130C] text-[#F1F6F2] border-[#172B1E]'
    : 'bg-[#F5F3EC] text-[#11281B] border-[#E3DFD3]';

  const renderSidebarBody = (isMobileDrawer: boolean) => (
    <div className={`flex h-full flex-col justify-between ${sidebarSurface}`}>
      <div>
        {/* Brand Header */}
        <div
          className={`flex h-16 items-center justify-between px-4 ${
            isDark ? 'border-b border-[#16281D]' : 'border-b border-[#E5E2D6]'
          }`}
        >
          <button
            type="button"
            onClick={onBackToHomepage}
            title="Back to LINELESS Homepage"
            className="flex min-w-0 items-center gap-2.5"
          >
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isDark ? 'bg-[#2EA45F] text-white' : 'bg-[#1B4332] text-white'
              }`}
            >
              <LinelessMark size={16} />
            </span>
            <span className="font-display truncate text-base font-bold tracking-[0.06em]">
              LINELESS
            </span>
          </button>

          {isMobileDrawer && (
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close staff menu"
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isDark
                  ? 'text-[#9BB2A3] hover:bg-[#13251A]'
                  : 'text-[#4B6356] hover:bg-[#EAE7DC]'
              }`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* ONLY 2 Sidebar Navigation Items */}
        <nav aria-label="Staff workspace navigation" className="space-y-1.5 px-3 py-4">
          <button
            type="button"
            onClick={() => {
              setActiveSection('queue');
              setMobileNavOpen(false);
            }}
            aria-current={activeSection === 'queue' ? 'page' : undefined}
            className={`relative flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              activeSection === 'queue'
                ? isDark
                  ? 'border border-[#348F59]/65 bg-[#164228] text-white'
                  : 'border border-[#A7D8B9] bg-[#E2F4E9] text-[#103823]'
                : isDark
                ? 'border border-transparent text-[#9FB4A6] hover:bg-[#102016] hover:text-white'
                : 'border border-transparent text-[#3B5245] hover:bg-[#ECE9DF] hover:text-[#11281B]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <MessageSquare className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate">Queue &amp; Desk Chat</span>
            </span>
            {totalUnreadMessages > 0 && (
              <span
                className={`font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  isDark ? 'bg-[#2EA45F] text-white' : 'bg-[#1B4332] text-white'
                }`}
              >
                {totalUnreadMessages}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('history');
              setMobileNavOpen(false);
            }}
            aria-current={activeSection === 'history' ? 'page' : undefined}
            className={`relative flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              activeSection === 'history'
                ? isDark
                  ? 'border border-[#348F59]/65 bg-[#164228] text-white'
                  : 'border border-[#A7D8B9] bg-[#E2F4E9] text-[#103823]'
                : isDark
                ? 'border border-transparent text-[#9FB4A6] hover:bg-[#102016] hover:text-white'
                : 'border border-transparent text-[#3B5245] hover:bg-[#ECE9DF] hover:text-[#11281B]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <History className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate">Visit History</span>
            </span>
          </button>
        </nav>
      </div>

      {/* Bottom Staff Account Menu */}
      <div
        ref={menuRef}
        className={`relative p-3 ${
          isDark ? 'border-t border-[#16281D]' : 'border-t border-[#E5E2D6]'
        }`}
      >
        {accountMenuOpen && (
          <div
            role="menu"
            aria-label="Staff account options"
            className={`absolute right-3 bottom-full left-3 mb-2 overflow-hidden rounded-xl border py-1.5 shadow-lg ${
              isDark
                ? 'border-[#1E3828] bg-[#0D1C13] text-[#EEF5F0]'
                : 'border-[#DCD9CD] bg-white text-[#11281B]'
            }`}
          >
            <div
              className={`px-3.5 py-2 text-xs ${
                isDark
                  ? 'border-b border-[#182E20] text-[#8EA797]'
                  : 'border-b border-[#ECE9DF] text-[#5B7063]'
              }`}
            >
              <p className={`truncate font-semibold ${isDark ? 'text-white' : 'text-[#11281B]'}`}>
                {staffName}
              </p>
              <p className="truncate">
                {isDemoStaff ? 'Demo Staff · 2408' : staffEmail}
              </p>
              <p className="mt-0.5 truncate text-[11px] opacity-85">
                {branch.displayName}
              </p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileNavOpen(false);
                onSwitchBranch();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Switch branch</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleTheme();
                setAccountMenuOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              {isDark ? (
                <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>

            {isDemoStaff && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  resetDemoQueue();
                  setSelectedTarget(null);
                  setAccountMenuOpen(false);
                  setMobileNavOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                  isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
                }`}
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Reset Demo Data</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileNavOpen(false);
                onBackToHomepage();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Back to Homepage</span>
            </button>

            <div
              className={`my-1 ${
                isDark ? 'border-t border-[#182E20]' : 'border-t border-[#ECE9DF]'
              }`}
            />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileNavOpen(false);
                onSignOut();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold transition-colors ${
                isDark
                  ? 'text-[#FCA5A5] hover:bg-[#241313]'
                  : 'text-[#B91C1C] hover:bg-[#FEF2F2]'
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isDemoStaff ? 'Sign out (Demo)' : 'Sign out'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountMenuOpen((o) => !o)}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
            isDark ? 'hover:bg-[#112217]' : 'hover:bg-[#EAE7DC]'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isDark ? 'bg-[#1D5A36] text-[#DCF5E5]' : 'bg-[#1B4332] text-[#F5FAF6]'
              }`}
            >
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{staffName}</span>
              <span
                className={`block truncate text-[11px] ${
                  isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'
                }`}
              >
                {branch.bankName}
              </span>
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              accountMenuOpen ? 'rotate-180' : ''
            } ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`flex min-h-screen transition-colors ${
        isDark ? 'bg-[#060E09] text-[#F2F6F3]' : 'bg-[#FAF8F2] text-[#10281B]'
      }`}
    >
      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden w-[240px] shrink-0 border-r lg:block ${
          isDark ? 'border-[#172B1E]' : 'border-[#E3DFD3]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarBody(false)}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            className={`relative z-10 h-full w-[268px] max-w-[85vw] border-r shadow-2xl ${
              isDark ? 'border-[#172B1E]' : 'border-[#E3DFD3]'
            }`}
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      {/* Main Content Canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Branch Header */}
        <header
          className={`border-b px-4 py-3.5 sm:px-6 ${
            isDark ? 'border-[#172B1E] bg-[#08130C]' : 'border-[#E3DFD3] bg-[#F5F3EC]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open staff menu"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border lg:hidden ${
                  isDark
                    ? 'border-[#1E3828] bg-[#0B1A11] text-white'
                    : 'border-[#D8D4C7] bg-white text-[#10281B]'
                }`}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>

              <BankEmblem brand={branch.brandId} className="h-10 w-10" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display truncate text-base font-bold sm:text-lg">
                    {branch.displayName}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isDeskPaused
                        ? isDark
                          ? 'bg-[#3B2B10] text-[#FCD34D]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                        : isDark
                        ? 'bg-[#153D24] text-[#8CE2AE]'
                        : 'bg-[#E2F4E9] text-[#11482B]'
                    }`}
                  >
                    {isDeskPaused ? 'Paused' : 'Open'}
                  </span>
                </div>
                <p
                  className={`truncate text-xs ${
                    isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'
                  }`}
                >
                  {branch.address}
                </p>
              </div>
            </div>

            {activeSection === 'queue' && selectedDesk && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnnouncementOpen(true)}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isDark
                      ? 'border-[#203D2B] bg-[#0B1A11] text-[#D7E6DC] hover:bg-[#13291B]'
                      : 'border-[#D8D4C7] bg-white text-[#10281B] hover:bg-[#EFECE3]'
                  }`}
                >
                  <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Send announcement</span>
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void runSafeAction('pause', () =>
                      toggleServicePause(selectedDesk.queueServiceId)
                    )
                  }
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                    isDeskPaused
                      ? isDark
                        ? 'border-[#2B6844] bg-[#143722] text-[#9EF0BE]'
                        : 'border-[#9AD8B4] bg-[#E2F4E9] text-[#11482B]'
                      : isDark
                      ? 'border-[#203D2B] bg-[#0B1A11] text-[#D7E6DC] hover:bg-[#13291B]'
                      : 'border-[#D8D4C7] bg-white text-[#10281B] hover:bg-[#EFECE3]'
                  }`}
                >
                  {isDeskPaused ? (
                    <>
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Resume queue</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Pause queue</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={waitingTickets.length === 0 || busyAction !== null}
                  onClick={handleOpenCallNextConfirm}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    isDark
                      ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                      : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                  }`}
                >
                  <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Call next</span>
                </button>
              </div>
            )}
          </div>

          {/* Multi-Desk Tabs when branch has > 1 desk */}
          {activeSection === 'queue' && branch.desks.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {branch.desks.map((desk) => {
                const active = desk.queueServiceId === selectedDesk?.queueServiceId;
                const deskWaiting = branchTickets.filter(
                  (t) => t.serviceId === desk.queueServiceId && t.status === 'waiting'
                ).length;
                return (
                  <button
                    key={desk.queueServiceId}
                    type="button"
                    onClick={() => {
                      setActiveDeskServiceId(desk.queueServiceId);
                      setCallNextOpen(false);
                    }}
                    className={`inline-flex min-h-[34px] shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? isDark
                          ? 'border-[#348F59] bg-[#164228] text-white'
                          : 'border-[#1B4332] bg-[#1B4332] text-white'
                        : isDark
                        ? 'border-[#1C3525] bg-[#0B1A11] text-[#9EB5A6] hover:bg-[#122619]'
                        : 'border-[#DCD9CD] bg-white text-[#375142] hover:bg-[#EFECE3]'
                    }`}
                  >
                    <span>{desk.name}</span>
                    <span
                      className={`font-mono-tabular rounded-full px-1.5 py-0.5 text-[11px] ${
                        active
                          ? 'bg-white/20 text-white'
                          : isDark
                          ? 'bg-[#152D1E] text-[#8CE2AE]'
                          : 'bg-[#E8F2EC] text-[#1B4332]'
                      }`}
                    >
                      {deskWaiting}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Body Content */}
        <main className="flex-1 p-4 sm:p-6">
          {actionError && (
            <div
              role="alert"
              className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
                isDark
                  ? 'border-[#5A2424] bg-[#251212] text-[#FCA5A5]'
                  : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError('')}
                className="font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Counter Confirmation Bar for Primary "Call next" */}
          {activeSection === 'queue' && callNextOpen && waitingTickets[0] && (
            <div
              className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                isDark
                  ? 'border-[#348F59] bg-[#0F2619]'
                  : 'border-[#A7D8B9] bg-[#E8F6EE]'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  Call{' '}
                  <span className="font-mono-tabular">{waitingTickets[0].ticketNumber}</span>{' '}
                  ({waitingTickets[0].visitorName || 'Walk-in'})
                </p>
                <p className={`text-xs ${isDark ? 'text-[#A9C9B6]' : 'text-[#28513A]'}`}>
                  Confirm the counter number before alerting the visitor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {availableCounters.map((counter) => (
                  <button
                    key={counter}
                    type="button"
                    onClick={() => setChosenCallNextCounter(counter)}
                    className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      chosenCallNextCounter === counter
                        ? isDark
                          ? 'border-[#4AD17E] bg-[#1C5534] text-white'
                          : 'border-[#1B4332] bg-[#1B4332] text-white'
                        : isDark
                        ? 'border-[#254A34] bg-[#0A180F] text-[#B9D2C3]'
                        : 'border-[#C5DEC9] bg-white text-[#10281B]'
                    }`}
                  >
                    {counter}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCallNextOpen(false)}
                  className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold whitespace-nowrap ${
                    isDark
                      ? 'border-[#233F2E] bg-[#08130C] text-[#A9C2B3]'
                      : 'border-[#D5D2C5] bg-white text-[#4D5E52]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleConfirmCallNext()}
                  className={`min-h-[36px] rounded-xl px-4 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                    isDark
                      ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                      : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                  }`}
                >
                  {busyAction === 'call_next' ? 'Calling...' : 'Confirm call'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'history' ? (
            <StaffVisitHistory
              staffTheme={staffTheme}
              branch={branch}
              branchTickets={branchTickets}
              reasonLookup={resolveTicketReason}
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[356px_minmax(0,1fr)]">
              {/* Left Column: Queue & Messages */}
              <section
                className={`flex flex-col overflow-hidden rounded-2xl border ${
                  isDark
                    ? 'border-[#193022] bg-[#0B1A11]'
                    : 'border-[#E3E0D4] bg-white'
                }`}
              >
                {/* Segmented Toggle: Queue | Messages (N) */}
                <div
                  className={`grid grid-cols-2 gap-1.5 border-b p-2.5 ${
                    isDark ? 'border-[#182E20]' : 'border-[#EAE7DC]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLeftTab('queue')}
                    className={`flex min-h-[38px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      leftTab === 'queue'
                        ? isDark
                          ? 'bg-[#164228] text-white'
                          : 'bg-[#E2F4E9] text-[#103823]'
                        : isDark
                        ? 'text-[#9AB3A4] hover:bg-[#102217]'
                        : 'text-[#4D5E52] hover:bg-[#F5F3EC]'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Queue</span>
                    <span className="font-mono-tabular opacity-80">
                      ({nowServingTickets.length + waitingTickets.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftTab('messages')}
                    className={`flex min-h-[38px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      leftTab === 'messages'
                        ? isDark
                          ? 'bg-[#164228] text-white'
                          : 'bg-[#E2F4E9] text-[#103823]'
                        : isDark
                        ? 'text-[#9AB3A4] hover:bg-[#102217]'
                        : 'text-[#4D5E52] hover:bg-[#F5F3EC]'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Messages</span>
                    {totalUnreadMessages > 0 && (
                      <span
                        className={`font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                          isDark ? 'bg-[#2EA45F] text-white' : 'bg-[#1B4332] text-white'
                        }`}
                      >
                        {totalUnreadMessages}
                      </span>
                    )}
                  </button>
                </div>

                {/* Left List Content */}
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-2.5">
                  {leftTab === 'queue' ? (
                    nowServingTickets.length === 0 && waitingTickets.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#5E7366] dark:text-[#89A594]">
                        No active tickets in {selectedDesk?.name}. New online bookings and QR walk-ins will appear here in FIFO order.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Now Serving */}
                        {nowServingTickets.length > 0 && (
                          <div>
                            <p
                              className={`px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                                isDark ? 'text-[#7BE0A2]' : 'text-[#18603B]'
                              }`}
                            >
                              Now serving ({nowServingTickets.length})
                            </p>
                            <div className="space-y-1.5">
                              {nowServingTickets.map((ticket) => {
                                const isSelected =
                                  selectedTarget?.kind === 'ticket' &&
                                  selectedTarget.ticketId === ticket.id;
                                const linkedThread = findThreadForTicket(ticket);
                                const reason = resolveTicketReason(ticket);
                                return (
                                  <button
                                    key={ticket.id}
                                    type="button"
                                    onClick={() => handleSelectTicketRow(ticket)}
                                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                      isSelected
                                        ? isDark
                                          ? 'border-[#4AD17E] bg-[#143723]'
                                          : 'border-[#1B4332] bg-[#E2F4E9]'
                                        : isDark
                                        ? 'border-[#1A3324] bg-[#0D2115] hover:border-[#2C553C]'
                                        : 'border-[#D3E5DA] bg-[#F5FBF7] hover:border-[#9ECBAE]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono-tabular text-sm font-bold">
                                          {ticket.ticketNumber}
                                        </span>
                                        <span className="truncate text-sm font-semibold">
                                          {ticket.visitorName || 'Walk-in'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {linkedThread && linkedThread.unreadForStaff > 0 && (
                                          <span
                                            aria-label="Unread visitor message"
                                            className="h-2 w-2 rounded-full bg-[#1D7A48] dark:bg-[#5CE092]"
                                          />
                                        )}
                                        <span
                                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                            isDark
                                              ? 'bg-[#1D5233] text-[#BDF5D2]'
                                              : 'bg-[#1B4332] text-white'
                                          }`}
                                        >
                                          {ticket.counter || 'Called'}
                                        </span>
                                      </div>
                                    </div>
                                    <p
                                      className={`mt-1 truncate text-xs ${
                                        isDark ? 'text-[#9BB5A6]' : 'text-[#4D5E52]'
                                      }`}
                                    >
                                      {ticket.channel === 'walk-in' ? 'QR Walk-in' : 'Online'}
                                      {reason ? ` · ${reason}` : ''}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Waiting FIFO */}
                        {waitingTickets.length > 0 && (
                          <div>
                            <p
                              className={`px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                                isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'
                              }`}
                            >
                              Waiting ({waitingTickets.length})
                            </p>
                            <div className="space-y-1.5">
                              {waitingTickets.map((ticket, index) => {
                                const isSelected =
                                  selectedTarget?.kind === 'ticket' &&
                                  selectedTarget.ticketId === ticket.id;
                                const linkedThread = findThreadForTicket(ticket);
                                const reason = resolveTicketReason(ticket);
                                return (
                                  <button
                                    key={ticket.id}
                                    type="button"
                                    onClick={() => handleSelectTicketRow(ticket)}
                                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                      isSelected
                                        ? isDark
                                          ? 'border-[#4AD17E] bg-[#143723]'
                                          : 'border-[#1B4332] bg-[#E2F4E9]'
                                        : isDark
                                        ? 'border-[#182E20] bg-[#08130C] hover:border-[#2A4D38]'
                                        : 'border-[#E6E3D7] bg-[#FAF8F2] hover:border-[#C7C3B6]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="font-mono-tabular text-sm font-bold">
                                          {ticket.ticketNumber}
                                        </span>
                                        <span className="truncate text-sm font-semibold">
                                          {ticket.visitorName || 'Walk-in'}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        {linkedThread && linkedThread.unreadForStaff > 0 && (
                                          <span
                                            aria-label="Unread visitor message"
                                            className="h-2 w-2 rounded-full bg-[#1D7A48] dark:bg-[#5CE092]"
                                          />
                                        )}
                                        <span
                                          className={`font-mono-tabular text-[11px] ${
                                            isDark ? 'text-[#89A594]' : 'text-[#546B5E]'
                                          }`}
                                        >
                                          #{index + 1} · {waitingMinutes(ticket.createdAt)}m
                                        </span>
                                      </div>
                                    </div>
                                    <p
                                      className={`mt-1 truncate text-xs ${
                                        isDark ? 'text-[#9BB5A6]' : 'text-[#4D5E52]'
                                      }`}
                                    >
                                      {ticket.channel === 'walk-in' ? 'QR Walk-in' : 'Online'}
                                      {reason ? ` · ${reason}` : ''}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : branchThreads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#5E7366] dark:text-[#89A594]">
                      No visitor conversations for {branch.branchName} yet. Pre-booking questions and active ticket chats will appear here.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {branchThreads.map((thread) => {
                        const isSelected =
                          selectedTarget?.kind === 'thread' &&
                          selectedTarget.channelId === thread.channelId;
                        return (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => handleSelectThreadRow(thread)}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? isDark
                                  ? 'border-[#4AD17E] bg-[#143723]'
                                  : 'border-[#1B4332] bg-[#E2F4E9]'
                                : isDark
                                ? 'border-[#182E20] bg-[#08130C] hover:border-[#2A4D38]'
                                : 'border-[#E6E3D7] bg-[#FAF8F2] hover:border-[#C7C3B6]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold">
                                {thread.visitorName}
                              </span>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {thread.unreadForStaff > 0 && (
                                  <span
                                    className={`font-mono-tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                      isDark
                                        ? 'bg-[#2EA45F] text-white'
                                        : 'bg-[#1B4332] text-white'
                                    }`}
                                  >
                                    {thread.unreadForStaff}
                                  </span>
                                )}
                                <span
                                  className={`font-mono-tabular rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                    thread.ticketNumber
                                      ? isDark
                                        ? 'bg-[#173A25] text-[#9CF0BD]'
                                        : 'bg-[#E2F4E9] text-[#11482B]'
                                      : isDark
                                      ? 'bg-[#1A2920] text-[#9BB2A3]'
                                      : 'bg-[#ECE9DE] text-[#4D5E52]'
                                  }`}
                                >
                                  {thread.ticketNumber || 'No ticket yet'}
                                </span>
                              </div>
                            </div>
                            {thread.reason && (
                              <p
                                className={`mt-0.5 truncate text-[11px] font-medium ${
                                  isDark ? 'text-[#7BE0A2]' : 'text-[#18603B]'
                                }`}
                              >
                                {thread.reason}
                              </p>
                            )}
                            <p
                              className={`mt-1 truncate text-xs ${
                                isDark ? 'text-[#9BB5A6]' : 'text-[#546B5E]'
                              }`}
                            >
                              {thread.lastMessageText || 'Conversation started'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Right Column: Ticket Controls + Private Desk Chat */}
              <section
                className={`flex min-h-[540px] flex-col overflow-hidden rounded-2xl border ${
                  isDark
                    ? 'border-[#193022] bg-[#0B1A11]'
                    : 'border-[#E3E0D4] bg-white'
                }`}
              >
                {!activeTicket && !activeThread ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                    <TicketIcon
                      className={`h-8 w-8 ${isDark ? 'text-[#547260]' : 'text-[#83978A]'}`}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-semibold">
                      Select a ticket or conversation
                    </p>
                    <p
                      className={`mt-1 max-w-sm text-xs ${
                        isDark ? 'text-[#89A594]' : 'text-[#546B5E]'
                      }`}
                    >
                      Choose a waiting customer or walk-in on the left to manage their counter turn, view their booking reason, or reply directly.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Detail & Controls Header */}
                    <div
                      className={`border-b p-4 sm:p-5 ${
                        isDark ? 'border-[#182E20]' : 'border-[#EAE7DC]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono-tabular rounded-lg px-2.5 py-1 text-sm font-bold ${
                                activeTicket?.ticketNumber || activeThread?.ticketNumber
                                  ? isDark
                                    ? 'bg-[#173D26] text-[#9CF0BD]'
                                    : 'bg-[#E2F4E9] text-[#11482B]'
                                  : isDark
                                  ? 'bg-[#1A2C21] text-[#9BB2A3]'
                                  : 'bg-[#EFECE3] text-[#4D5E52]'
                              }`}
                            >
                              {activeTicket?.ticketNumber ||
                                activeThread?.ticketNumber ||
                                'No ticket yet'}
                            </span>

                            <h2 className="font-display truncate text-lg font-bold">
                              {activeTicket?.visitorName ||
                                activeThread?.visitorName ||
                                'Visitor'}
                            </h2>

                            {activeTicket && (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                                  activeTicket.status === 'called' ||
                                  activeTicket.status === 'serving'
                                    ? isDark
                                      ? 'bg-[#1A4D2E] text-[#A2F4C3]'
                                      : 'bg-[#CBEAD8] text-[#0E4829]'
                                    : isDark
                                    ? 'bg-[#162C1F] text-[#A6BFB0]'
                                    : 'bg-[#F0EDE4] text-[#375142]'
                                }`}
                              >
                                {activeTicket.status}
                                {activeTicket.counter ? ` · ${activeTicket.counter}` : ''}
                              </span>
                            )}
                          </div>

                          <div
                            className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${
                              isDark ? 'text-[#9BB5A6]' : 'text-[#546B5E]'
                            }`}
                          >
                            <span>
                              {activeTicket
                                ? activeTicket.channel === 'walk-in'
                                  ? 'QR Walk-in'
                                  : 'Online booking'
                                : 'Pre-booking message'}
                            </span>
                            <span>·</span>
                            <span>
                              {branch.desks.find(
                                (d) =>
                                  d.queueServiceId ===
                                  (activeTicket?.serviceId || activeThread?.serviceId)
                              )?.name || selectedDesk?.name}
                            </span>
                            {activeTicket && (
                              <>
                                <span>·</span>
                                <span className="font-mono-tabular inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  Joined {formatTime(activeTicket.createdAt)}
                                </span>
                              </>
                            )}
                          </div>

                          {(activeTicket
                            ? resolveTicketReason(activeTicket)
                            : activeThread?.reason) && (
                            <p
                              className={`mt-2 text-xs font-medium ${
                                isDark ? 'text-[#CFE6D8]' : 'text-[#284233]'
                              }`}
                            >
                              Reason:{' '}
                              <span className="font-semibold">
                                {activeTicket
                                  ? resolveTicketReason(activeTicket)
                                  : activeThread?.reason}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Contextual Queue Action Controls */}
                        {activeTicket &&
                          (activeTicket.status === 'waiting' ||
                            activeTicket.status === 'called' ||
                            activeTicket.status === 'serving') && (
                            <div className="flex flex-wrap items-center gap-2">
                              {activeTicket.status === 'waiting' && (
                                <>
                                  {availableCounters.length > 1 && (
                                    <select
                                      aria-label="Counter for ticket"
                                      value={callSpecificCounter}
                                      onChange={(e) => setCallSpecificCounter(e.target.value)}
                                      className={`min-h-[38px] rounded-xl border px-2.5 text-xs font-semibold focus:outline-none ${
                                        isDark
                                          ? 'border-[#213E2C] bg-[#08130C] text-white'
                                          : 'border-[#D8D4C7] bg-[#FAF8F2] text-[#10281B]'
                                      }`}
                                    >
                                      {availableCounters.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busyAction !== null}
                                    onClick={() =>
                                      void runSafeAction(`call_${activeTicket.id}`, () =>
                                        callSpecificTicket(
                                          activeTicket.id,
                                          callSpecificCounter || recommendedCounter
                                        )
                                      )
                                    }
                                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                                      isDark
                                        ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                                        : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                                    }`}
                                  >
                                    <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Call to counter</span>
                                  </button>
                                </>
                              )}

                              {activeTicket.status === 'called' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyAction !== null}
                                    onClick={() =>
                                      void runSafeAction(`serve_${activeTicket.id}`, () =>
                                        markServing(activeTicket.id)
                                      )
                                    }
                                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                                      isDark
                                        ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                                        : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                                    }`}
                                  >
                                    <span>Start service</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyAction !== null}
                                    onClick={() =>
                                      void runSafeAction(`recall_${activeTicket.id}`, () =>
                                        recallTicket(activeTicket.id)
                                      )
                                    }
                                    className={`inline-flex min-h-[38px] items-center rounded-xl border px-3 text-xs font-semibold whitespace-nowrap ${
                                      isDark
                                        ? 'border-[#213E2C] bg-[#0D1E14] text-[#D7E6DC] hover:bg-[#142D1E]'
                                        : 'border-[#D8D4C7] bg-white text-[#10281B] hover:bg-[#EFECE3]'
                                    }`}
                                  >
                                    Recall
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() =>
                                  void runSafeAction(`complete_${activeTicket.id}`, () =>
                                    completeTicket(activeTicket.id)
                                  )
                                }
                                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap ${
                                  isDark
                                    ? 'border-[#2B6844] bg-[#143722] text-[#9EF0BE] hover:bg-[#1B4A2E]'
                                    : 'border-[#9AD8B4] bg-[#E2F4E9] text-[#11482B] hover:bg-[#CBEAD8]'
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Complete visit</span>
                              </button>

                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() =>
                                  void runSafeAction(`defer_${activeTicket.id}`, () =>
                                    deferTicket(activeTicket.id)
                                  )
                                }
                                className={`inline-flex min-h-[38px] items-center rounded-xl border px-3 text-xs font-semibold whitespace-nowrap ${
                                  isDark
                                    ? 'border-[#4D3616] bg-[#241A0B] text-[#FCD34D] hover:bg-[#31230E]'
                                    : 'border-[#F2CE88] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]'
                                }`}
                              >
                                Mark missed
                              </button>

                              {(activeTicket.status === 'called' ||
                                activeTicket.status === 'serving') && (
                                <button
                                  type="button"
                                  disabled={busyAction !== null}
                                  onClick={() =>
                                    void runSafeAction(`requeue_${activeTicket.id}`, () =>
                                      requeueTicket(activeTicket.id)
                                    )
                                  }
                                  className={`inline-flex min-h-[38px] items-center rounded-xl border px-3 text-xs font-semibold whitespace-nowrap ${
                                    isDark
                                      ? 'border-[#213E2C] bg-[#08130C] text-[#A9C2B3]'
                                      : 'border-[#D8D4C7] bg-white text-[#4D5E52]'
                                  }`}
                                >
                                  Re-queue
                                </button>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Lower Panel: QR Walk-in Summary OR Private Desk Chat */}
                    {isQrWalkInWithoutChat && activeTicket ? (
                      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                        <div
                          className={`w-full max-w-md rounded-2xl border p-6 ${
                            isDark
                              ? 'border-[#193022] bg-[#08130C]'
                              : 'border-[#E3E0D4] bg-[#FAF8F2]'
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              isDark ? 'text-[#7BE0A2]' : 'text-[#18603B]'
                            }`}
                          >
                            QR Walk-in Ticket
                          </p>
                          <p className="font-mono-tabular mt-2 text-3xl font-bold">
                            {activeTicket.ticketNumber}
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {activeTicket.visitorName || 'Walk-in'}
                          </p>
                          <p
                            className={`mt-3 text-xs leading-relaxed ${
                              isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'
                            }`}
                          >
                            Joined via branch entrance QR without signing in. Calling, counter assignment, or completion updates the visitor&apos;s phone screen automatically.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col justify-between">
                        {/* Conversation Timeline */}
                        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                          {activeChatMessages.length === 0 ? (
                            <div
                              className={`rounded-2xl border p-5 text-center text-xs ${
                                isDark
                                  ? 'border-[#182E20] bg-[#08130C] text-[#8FA899]'
                                  : 'border-[#E6E3D7] bg-[#FAF8F2] text-[#546B5E]'
                              }`}
                            >
                              No messages yet with {activeTicket?.visitorName || activeThread?.visitorName || 'this visitor'}. Send a message below — it appears immediately in their Desk Chat.
                            </div>
                          ) : (
                            activeChatMessages.map((msg) => {
                              const isStaffMsg = msg.senderRole === 'staff';
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${
                                    isStaffMsg ? 'items-end' : 'items-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                      isStaffMsg
                                        ? isDark
                                          ? 'bg-[#1D5A36] text-white'
                                          : 'bg-[#1B4332] text-white'
                                        : isDark
                                        ? 'border border-[#1E3828] bg-[#0F2216] text-[#EEF5F0]'
                                        : 'border border-[#E3E0D4] bg-[#FAF8F2] text-[#10281B]'
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                  <span
                                    className={`font-mono-tabular mt-1 px-1 text-[11px] ${
                                      isDark ? 'text-[#7F9A8A]' : 'text-[#607769]'
                                    }`}
                                  >
                                    {isStaffMsg ? 'Bank desk' : msg.senderName} ·{' '}
                                    {formatTime(msg.createdAt)}
                                  </span>
                                </div>
                              );
                            })
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Staff Reply Composer */}
                        {activeChannelId && (
                          <form
                            onSubmit={(e) => void handleSendStaffReply(e)}
                            className={`border-t p-3.5 sm:p-4 ${
                              isDark ? 'border-[#182E20]' : 'border-[#EAE7DC]'
                            }`}
                          >
                            <div className="flex items-end gap-2.5">
                              <label htmlFor="staff-reply-input" className="sr-only">
                                Reply to visitor
                              </label>
                              <input
                                id="staff-reply-input"
                                type="text"
                                value={replyDraftByChannel[activeChannelId] || ''}
                                onChange={(e) =>
                                  setReplyDraftByChannel((prev) => ({
                                    ...prev,
                                    [activeChannelId]: e.target.value,
                                  }))
                                }
                                placeholder={`Reply to ${
                                  activeTicket?.visitorName ||
                                  activeThread?.visitorName ||
                                  'visitor'
                                }...`}
                                className={`min-h-[44px] flex-1 rounded-xl border px-3.5 text-sm focus:outline-none ${
                                  isDark
                                    ? 'border-[#254330] bg-[#08130C] text-white placeholder:text-[#668070] focus:border-[#4AD17E]'
                                    : 'border-[#D5D2C5] bg-[#FAF8F2] text-[#10281B] placeholder:text-[#788D81] focus:border-[#1B4332]'
                                }`}
                              />
                              <button
                                type="submit"
                                disabled={!(replyDraftByChannel[activeChannelId] || '').trim()}
                                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                  isDark
                                    ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                                    : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                                }`}
                              >
                                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Send reply</span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Send Announcement Modal Overlay */}
      {selectedDesk && (
        <StaffAnnouncementOverlay
          isOpen={announcementOpen}
          onClose={() => setAnnouncementOpen(false)}
          staffTheme={staffTheme}
          branch={branch}
          selectedDesk={selectedDesk}
          branchAnnouncements={branchAnnouncements}
          onPublishAnnouncement={(serviceId, message, expiresAt) =>
            sendAnnouncement(serviceId, message, expiresAt)
          }
          onClearAnnouncement={clearAnnouncement}
        />
      )}
    </div>
  );
}
