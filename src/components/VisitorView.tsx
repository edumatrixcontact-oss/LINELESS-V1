import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, LogIn, Menu, MessageSquare, Search, Sparkles } from 'lucide-react';
import { DEMO_VISITOR_UID, useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { TicketBookingMeta, loadTicketBookingMetaMap, saveTicketBookingMeta } from '../data/discoveryCatalog';
import { ThemeMode, Ticket } from '../types/queue';
import { buildVisitorBranchCatalog, findBranchForServiceId, formatCounterTurnText } from './visitor/branchCatalog';
import {
  BranchConversationMeta,
  ConversationMode,
  DeskSystemEvent,
  QueueAIBookingForm,
  QueueAIMessage,
  VisitorNavTab,
  VisitorThemeMode,
} from './visitor/types';
import { useVisitorNexconn } from './visitor/useVisitorNexconn';
import { VisitorDeskChat } from './visitor/VisitorDeskChat';
import { VisitorMyTickets } from './visitor/VisitorMyTickets';
import { VisitorProfile } from './visitor/VisitorProfile';
import { QueueAIPendingIntent, VisitorQueueAI } from './visitor/VisitorQueueAI';
import { VisitorSidebar } from './visitor/VisitorSidebar';
import {
  VISITOR_AVATAR_EVENT,
  loadBranchSessions,
  loadVisitorAvatar,
  saveBranchSessions,
} from './visitor/visitorStorage';

interface VisitorViewProps {
  onNavigateAuth: (initialMode?: 'login' | 'register') => void;
  onExitDemo?: () => void;
  onBackToHomepage?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

const INITIAL_QUEUE_AI_MESSAGE: QueueAIMessage = {
  id: 'qai_welcome',
  role: 'assistant',
  text: 'Where would you like to visit?',
  timestamp: Date.now(),
  suggestions: [
    {
      label: 'Find an open desk',
      action: 'ask-query',
      queryText: 'Find an open desk',
    },
    {
      label: 'Check a wait time',
      action: 'ask-query',
      queryText: 'Check a wait time',
    },
  ],
};

export function VisitorView({
  onNavigateAuth,
  onExitDemo,
  onBackToHomepage,
}: VisitorViewProps) {
  const {
    user,
    profile,
    isDemoVisitor,
    authReady,
    logout,
    updatePreferences,
    enterDemoVisitorMode,
    exitDemoVisitorMode,
  } = useAuth();
  const {
    services,
    queueFeed,
    tickets,
    announcements,
    supportThreads,
    branchChatThreads,
    loadingQueue,
    joinQueue,
    leaveQueue,
    createSupportThread,
    sendSupportMessage,
    subscribeToThreadMessages,
    upsertBranchChatThread,
    sendBranchChatMessage,
    getBranchChatMessages,
    getServiceById,
    getTicketPosition,
    getServiceEstimatedWait,
  } = useQueue();

  // Visitor-scoped theme ALWAYS defaults to light mode per design spec
  const [visitorTheme, setVisitorTheme] = useState<VisitorThemeMode>('light');
  const isDark = visitorTheme === 'dark';

  // Post-login default: Conversations -> Queue AI
  const [activeNav, setActiveNav] = useState<VisitorNavTab>('conversations');
  const [conversationMode, setConversationMode] = useState<ConversationMode>('queue-ai');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasVisitorWorkspace = Boolean(user || isDemoVisitor);
  const activeVisitorUid = isDemoVisitor ? DEMO_VISITOR_UID : user?.uid ?? null;
  const displayName = isDemoVisitor
    ? 'Demo Visitor'
    : profile?.name || user?.displayName || 'Visitor';
  const displayEmail = isDemoVisitor
    ? 'Demo session · Not signed in'
    : profile?.email || user?.email || '';

  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(() =>
    loadVisitorAvatar(activeVisitorUid)
  );
  const [ticketMetaMap, setTicketMetaMap] = useState<Record<string, TicketBookingMeta>>(() =>
    loadTicketBookingMetaMap()
  );

  // Unauthenticated lookup state
  const [showLookup, setShowLookup] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookedUpFeedId, setLookedUpFeedId] = useState<string | null>(null);

  useEffect(() => {
    setCustomAvatarUrl(loadVisitorAvatar(activeVisitorUid));
    const handleAvatarChange = (evt: Event) => {
      const detail = (evt as CustomEvent<{ uid?: string }>).detail;
      if (!detail || detail.uid === activeVisitorUid) {
        setCustomAvatarUrl(loadVisitorAvatar(activeVisitorUid));
      }
    };
    window.addEventListener(VISITOR_AVATAR_EVENT, handleAvatarChange);
    return () => window.removeEventListener(VISITOR_AVATAR_EVENT, handleAvatarChange);
  }, [activeVisitorUid]);

  const resolvedAvatarUrl = customAvatarUrl || (!isDemoVisitor ? user?.photoURL ?? null : null);

  // Unified live branches catalog
  const branches = useMemo(
    () =>
      buildVisitorBranchCatalog({
        services,
        queueFeed,
        announcements,
        isDemoVisitor,
      }),
    [services, queueFeed, announcements, isDemoVisitor]
  );

  const myTickets = useMemo(() => {
    if (!activeVisitorUid) return [];
    return tickets.filter((t) => t.userId === activeVisitorUid);
  }, [tickets, activeVisitorUid]);

  const activeTickets = useMemo(() => {
    const priority: Record<string, number> = { called: 0, serving: 1, waiting: 2 };
    return myTickets
      .filter((t) => t.status === 'waiting' || t.status === 'called' || t.status === 'serving')
      .sort((a, b) => {
        const pa = priority[a.status] ?? 3;
        const pb = priority[b.status] ?? 3;
        if (pa !== pb) return pa - pb;
        return a.queueOrderAt - b.queueOrderAt;
      });
  }, [myTickets]);

  const pastTickets = useMemo(
    () =>
      myTickets
        .filter((t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'deferred')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [myTickets]
  );

  // Persistent Queue AI state across mode/tab switches
  const [queueAIMessages, setQueueAIMessages] = useState<QueueAIMessage[]>([
    INITIAL_QUEUE_AI_MESSAGE,
  ]);
  const [queueAIDraft, setQueueAIDraft] = useState('');
  const [queueAIPendingIntent, setQueueAIPendingIntent] =
    useState<QueueAIPendingIntent | null>(null);
  const [queueAIBookingForm, setQueueAIBookingForm] = useState<QueueAIBookingForm>(() => ({
    open: false,
    visitorName: displayName,
    branchKey: '',
    serviceId: '',
    reason: '',
    isSubmitting: false,
    error: '',
  }));

  useEffect(() => {
    setQueueAIBookingForm((prev) =>
      prev.visitorName ? prev : { ...prev, visitorName: displayName }
    );
  }, [displayName]);

  // Persistent Desk Chat branch sessions & drafts
  const [branchSessions, setBranchSessions] = useState<Record<string, BranchConversationMeta>>(() =>
    loadBranchSessions<BranchConversationMeta>(activeVisitorUid)
  );
  const [activeBranchKey, setActiveBranchKey] = useState<string | null>(null);
  const [lastActiveBranchKey, setLastActiveBranchKey] = useState<string | null>(null);
  const [deskDraftByBranch, setDeskDraftByBranch] = useState<Record<string, string>>({});
  const [systemEvents, setSystemEvents] = useState<DeskSystemEvent[]>([]);
  const seenCalledKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loaded = loadBranchSessions<BranchConversationMeta>(activeVisitorUid);
    setBranchSessions(loaded);
    const latest = Object.values(loaded).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setLastActiveBranchKey(latest?.branchKey ?? null);
  }, [activeVisitorUid]);

  const persistBranchSessions = useCallback(
    (updater: (prev: Record<string, BranchConversationMeta>) => Record<string, BranchConversationMeta>) => {
      setBranchSessions((prev) => {
        const next = updater(prev);
        saveBranchSessions(activeVisitorUid, next);
        return next;
      });
    },
    [activeVisitorUid]
  );

  const activeBranchChannelId = useMemo(() => {
    if (!activeBranchKey) return null;
    const uid = activeVisitorUid || DEMO_VISITOR_UID;
    return `bchat_${uid}::${activeBranchKey}`;
  }, [activeBranchKey, activeVisitorUid]);

  const activeBranchRelayMessages = useMemo(
    () => (activeBranchChannelId ? getBranchChatMessages(activeBranchChannelId) : []),
    [activeBranchChannelId, getBranchChatMessages]
  );

  const [lastSeenStaffMsgAt, setLastSeenStaffMsgAt] = useState<number>(() => Date.now());

  const isViewingDeskChat =
    activeNav === 'conversations' &&
    conversationMode === 'desk-chat' &&
    Boolean(activeBranchKey);

  // Track unread staff replies across all branch threads belonging to this visitor
  const relayUnreadCount = useMemo(() => {
    const uid = activeVisitorUid || DEMO_VISITOR_UID;
    const prefix = `bchat_${uid}::`;
    let count = 0;
    for (const thread of branchChatThreads) {
      if (!thread.channelId.startsWith(prefix)) continue;
      if (isViewingDeskChat && thread.branchKey === activeBranchKey) continue;
      const msgs = getBranchChatMessages(thread.channelId);
      for (const m of msgs) {
        if (m.senderRole === 'staff' && m.createdAt > lastSeenStaffMsgAt) {
          count += 1;
        }
      }
    }
    return count;
  }, [
    activeBranchKey,
    activeVisitorUid,
    branchChatThreads,
    getBranchChatMessages,
    isViewingDeskChat,
    lastSeenStaffMsgAt,
  ]);

  useEffect(() => {
    if (isViewingDeskChat) {
      setLastSeenStaffMsgAt(Date.now());
    }
  }, [isViewingDeskChat, activeBranchRelayMessages.length]);

  const nexconnState = useVisitorNexconn({
    enabled: hasVisitorWorkspace,
    firebaseUser: user,
    isDemoVisitor,
    displayName,
    activeVisitorUid,
    isViewingDeskChat,
    activeBranchKey: activeBranchKey || lastActiveBranchKey,
  });

  // Watch attached/active tickets for 'called' status to inject turn system updates inside Desk Chat
  useEffect(() => {
    for (const ticket of myTickets) {
      if (ticket.status !== 'called') continue;
      const key = `${ticket.id}:${ticket.calledAt ?? 0}:${ticket.counter ?? ''}`;
      if (seenCalledKeysRef.current.has(key)) continue;
      seenCalledKeysRef.current.add(key);

      const matched = findBranchForServiceId(branches, ticket.serviceId);
      const branchKey = matched?.branch.branchKey || `custom-${ticket.serviceId}`;
      const turnText = formatCounterTurnText(ticket.counter);

      setSystemEvents((prev) => {
        if (prev.some((e) => e.id === `sys_${key}`)) return prev;
        return [
          ...prev,
          {
            id: `sys_${key}`,
            branchKey,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            text: turnText,
            timestamp: ticket.calledAt ?? ticket.updatedAt ?? Date.now(),
          },
        ];
      });
    }
  }, [myTickets, branches]);

  const handleSelectBranchSession = useCallback(
    (meta: {
      branchKey: string;
      locationName: string;
      categoryId?: string;
      serviceId?: string;
      serviceName?: string;
      ticketId?: string;
      ticketNumber?: string;
    }) => {
      const now = Date.now();
      persistBranchSessions((prev) => {
        const existing = prev[meta.branchKey];
        return {
          ...prev,
          [meta.branchKey]: {
            branchKey: meta.branchKey,
            locationName: meta.locationName,
            categoryId: meta.categoryId ?? existing?.categoryId,
            serviceId: meta.serviceId ?? existing?.serviceId,
            serviceName: meta.serviceName ?? existing?.serviceName,
            ticketId: meta.ticketId ?? existing?.ticketId,
            ticketNumber: meta.ticketNumber ?? existing?.ticketNumber,
            firstTaggedSent: existing?.firstTaggedSent ?? false,
            updatedAt: now,
          },
        };
      });
      setActiveBranchKey(meta.branchKey);
      setLastActiveBranchKey(meta.branchKey);
      setActiveNav('conversations');
      setConversationMode('desk-chat');
    },
    [persistBranchSessions]
  );

  // Switch top segmented control to Desk Chat with smart auto-open rules
  const handleSwitchConversationMode = useCallback(
    (mode: ConversationMode) => {
      setActiveNav('conversations');
      setConversationMode(mode);
      if (mode !== 'desk-chat') return;

      if (activeBranchKey) return;

      if (lastActiveBranchKey && branchSessions[lastActiveBranchKey]) {
        setActiveBranchKey(lastActiveBranchKey);
        return;
      }

      if (activeTickets.length === 1) {
        const single = activeTickets[0];
        const matched = findBranchForServiceId(branches, single.serviceId);
        if (matched) {
          handleSelectBranchSession({
            branchKey: matched.branch.branchKey,
            locationName: matched.branch.locationName,
            categoryId: matched.branch.categoryId,
            serviceId: matched.desk.serviceId,
            serviceName: matched.desk.name,
            ticketId: single.id,
            ticketNumber: single.ticketNumber,
          });
        }
      }
    },
    [
      activeBranchKey,
      activeTickets,
      branchSessions,
      branches,
      handleSelectBranchSession,
      lastActiveBranchKey,
    ]
  );

  const handleOpenDeskChatForBranch = useCallback(
    (params: {
      branchKey: string;
      locationName: string;
      serviceId?: string;
      serviceName?: string;
      categoryId?: string;
      ticketId?: string;
      ticketNumber?: string;
    }) => {
      handleSelectBranchSession({
        branchKey: params.branchKey,
        locationName: params.locationName,
        categoryId: params.categoryId,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
      });
    },
    [handleSelectBranchSession]
  );

  const handleOpenDeskChatForTicket = useCallback(
    (ticket: Ticket) => {
      const matched = findBranchForServiceId(branches, ticket.serviceId);
      const svc = getServiceById(ticket.serviceId);
      const branchKey = matched?.branch.branchKey || `custom-${ticket.serviceId}`;
      const locationName = matched?.branch.locationName || svc?.facility || 'Bank Branch';
      const serviceName = matched?.desk.name || svc?.name || ticket.serviceId;
      handleSelectBranchSession({
        branchKey,
        locationName,
        categoryId: matched?.branch.categoryId,
        serviceId: ticket.serviceId,
        serviceName,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
      });
    },
    [branches, getServiceById, handleSelectBranchSession]
  );

  // Confirm booking from Queue AI -> real QueueContext.joinQueue + attach ticket to branch session
  const handleConfirmBooking = useCallback(
    async (params: {
      visitorName: string;
      branchKey: string;
      serviceId: string;
      reason: string;
    }): Promise<Ticket> => {
      const branch = branches.find((b) => b.branchKey === params.branchKey);
      const desk = branch?.desks.find((d) => d.serviceId === params.serviceId);

      const created = await joinQueue(
        params.serviceId,
        params.visitorName,
        desk?.demoCatalogSeed,
        params.reason
      );

      if (!created) {
        throw new Error('Unable to create queue ticket. Please try again.');
      }

      const bookingMeta: TicketBookingMeta = {
        ticketId: created.id,
        locationId: branch?.branchKey || params.branchKey,
        locationName: branch?.locationName || 'Bank Branch',
        locationAddress: branch?.address || '',
        categoryName: branch?.categoryName || 'Banking Desk',
        subServiceName: desk?.name || created.serviceId,
        reason: params.reason || undefined,
        createdAt: created.createdAt,
      };
      saveTicketBookingMeta(bookingMeta);
      setTicketMetaMap((prev) => ({
        ...prev,
        [created.id]: bookingMeta,
      }));

      // Attach ticket to existing/new branch session seamlessly (preserving pre-booking history!)
      const bKey = branch?.branchKey || params.branchKey;
      persistBranchSessions((prev) => {
        const existing = prev[bKey];
        return {
          ...prev,
          [bKey]: {
            branchKey: bKey,
            locationName: branch?.locationName || existing?.locationName || 'Bank Branch',
            categoryId: branch?.categoryId ?? existing?.categoryId,
            serviceId: created.serviceId,
            serviceName: desk?.name ?? existing?.serviceName,
            ticketId: created.id,
            ticketNumber: created.ticketNumber,
            firstTaggedSent: existing?.firstTaggedSent ?? false,
            updatedAt: Date.now(),
          },
        };
      });

      // Upgrade any existing pre-booking staff inbox conversation for this visitor & branch
      const uid = activeVisitorUid || DEMO_VISITOR_UID;
      const channelId = `bchat_${uid}::${bKey}`;
      if (branchChatThreads.some((t) => t.channelId === channelId || (t.visitorUid === uid && t.branchKey === bKey))) {
        upsertBranchChatThread({
          channelId,
          visitorUid: uid,
          visitorName: params.visitorName.trim() || displayName,
          branchKey: bKey,
          locationName: branch?.locationName || 'Bank Branch',
          serviceId: created.serviceId,
          serviceName: desk?.name || created.serviceId,
          ticketId: created.id,
          ticketNumber: created.ticketNumber,
          reason: params.reason.trim() || null,
          unreadForStaffIncrement: 0,
        });
      }

      return created;
    },
    [
      activeVisitorUid,
      branchChatThreads,
      branches,
      displayName,
      joinQueue,
      persistBranchSessions,
      upsertBranchChatThread,
    ]
  );

  const handleRelayBranchMessage = useCallback(
    (params: {
      branchKey: string;
      locationName: string;
      serviceId?: string | null;
      serviceName?: string | null;
      ticket?: Ticket | null;
      text: string;
    }) => {
      const uid = activeVisitorUid || DEMO_VISITOR_UID;
      const channelId = `bchat_${uid}::${params.branchKey}`;
      const metaReason = params.ticket
        ? params.ticket.reason || ticketMetaMap[params.ticket.id]?.reason || null
        : null;

      sendBranchChatMessage({
        channelId,
        threadOwnerUid: uid,
        senderUid: uid,
        senderRole: 'visitor',
        senderName: displayName,
        text: params.text,
      });

      upsertBranchChatThread({
        channelId,
        visitorUid: uid,
        visitorName: displayName,
        branchKey: params.branchKey,
        locationName: params.locationName,
        serviceId: params.ticket?.serviceId ?? params.serviceId ?? null,
        serviceName: params.serviceName ?? null,
        ticketId: params.ticket?.id ?? null,
        ticketNumber: params.ticket?.ticketNumber ?? null,
        reason: metaReason,
        unreadForStaffIncrement: 1,
        lastMessageText: params.text,
        lastMessageAt: Date.now(),
      });
    },
    [activeVisitorUid, displayName, sendBranchChatMessage, ticketMetaMap, upsertBranchChatThread]
  );

  const handleSignOut = useCallback(async () => {
    if (isDemoVisitor) {
      exitDemoVisitorMode();
      onExitDemo?.();
      return;
    }
    if (user) {
      await logout();
      onExitDemo?.();
    }
  }, [isDemoVisitor, exitDemoVisitorMode, onExitDemo, user, logout]);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = lookupCode.trim().toUpperCase();
    if (!normalized) {
      setLookupError('Enter a ticket number such as B-105.');
      return;
    }
    const found = queueFeed.find(
      (f) => f.ticketNumber.toUpperCase() === normalized && f.status !== 'cancelled'
    );
    if (!found) {
      setLookupError(`No active ticket found for "${normalized}".`);
      setLookedUpFeedId(null);
      return;
    }
    setLookupError('');
    setLookedUpFeedId(found.id);
  };

  const lookedUpFeedItem = useMemo(
    () => (lookedUpFeedId ? queueFeed.find((f) => f.id === lookedUpFeedId) ?? null : null),
    [queueFeed, lookedUpFeedId]
  );

  if (!authReady && !isDemoVisitor) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center bg-[#FAF8F2] px-4 py-20 text-[#10281B]">
        <p className="text-sm font-medium text-[#546B5E]">
          Loading your LINELESS workspace...
        </p>
      </main>
    );
  }

  // Fallback public welcome view if rendered unauthenticated
  if (!hasVisitorWorkspace) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl bg-[#FAF8F2] px-4 py-10 text-[#10281B] sm:px-8 sm:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            <p className="text-sm font-semibold text-[#18603B]">
              LINELESS · A smarter way to wait
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[#10281B] sm:text-5xl">
              Hold your place in line from anywhere.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#4B6356]">
              Sign in or try Demo Visitor Mode to explore services, join live queues, and track your turn.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigateAuth('login')}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-xl bg-[#1B4332] px-7 text-sm font-semibold text-white hover:bg-[#143627]"
              >
                <span>Join a Queue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateAuth('register')}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-xl border border-[#1B4332]/30 bg-white px-5 text-sm font-semibold text-[#1B4332]"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Create Visitor Account</span>
              </button>
              <button
                type="button"
                onClick={enterDemoVisitorMode}
                className="inline-flex min-h-[50px] items-center rounded-xl border border-[#D97706]/40 bg-[#FFFBEB] px-5 text-sm font-semibold text-[#92400E]"
              >
                Try Demo Visitor Mode
              </button>
              <button
                type="button"
                onClick={() => setShowLookup((p) => !p)}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-xl border border-[#D7D3C7] bg-white px-5 text-sm font-semibold text-[#10281B]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Check Walk-in Ticket</span>
              </button>
            </div>

            {showLookup && (
              <form
                onSubmit={handleLookupSubmit}
                className="max-w-md space-y-3 rounded-2xl border border-[#DFDBD0] bg-white p-5"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    placeholder="e.g. B-105"
                    className="font-mono-tabular min-h-[44px] flex-1 rounded-xl border border-[#D5D1C5] bg-[#FAF9F5] px-3.5 text-sm uppercase"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-[#1B4332] px-4 text-sm font-semibold text-white"
                  >
                    Check
                  </button>
                </div>
                {lookupError && <p className="text-xs text-[#B91C1C]">{lookupError}</p>}
                {lookedUpFeedItem && (
                  <p className="text-sm font-semibold">
                    {lookedUpFeedItem.ticketNumber} · {lookedUpFeedItem.status}
                  </p>
                )}
              </form>
            )}
          </div>

          <aside className="rounded-2xl border border-[#DFDBD0] bg-white p-6 lg:col-span-5">
            <h2 className="font-display text-lg font-semibold">Live Bank Desks</h2>
            {loadingQueue ? (
              <p className="mt-4 text-sm text-[#546B5E]">Loading branches...</p>
            ) : (
              <div className="mt-4 divide-y divide-[#ECE8DD]">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[#546B5E]">{s.facility}</p>
                    </div>
                    <span className="font-mono-tabular text-sm font-semibold text-[#1B4332]">
                      ~{getServiceEstimatedWait(s.id)}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  return (
    <div
      data-visitor-theme={visitorTheme}
      className={`flex h-screen overflow-hidden transition-colors duration-150 ${
        isDark ? 'bg-[#060E09] text-[#F1F6F2]' : 'bg-[#FAF8F2] text-[#10281B]'
      }`}
    >
      <VisitorSidebar
        activeTab={activeNav}
        onSelectTab={setActiveNav}
        onBackToHomepage={() => onBackToHomepage?.()}
        onSignOut={() => void handleSignOut()}
        displayName={displayName}
        displaySubtitle={displayEmail}
        avatarUrl={resolvedAvatarUrl}
        isDemoVisitor={isDemoVisitor}
        activeTicketCount={activeTickets.length}
        unreadChatCount={nexconnState.unreadCount + relayUnreadCount}
        visitorTheme={visitorTheme}
        onToggleVisitorTheme={() =>
          setVisitorTheme((t) => (t === 'light' ? 'dark' : 'light'))
        }
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar: Mobile Menu Button + Centered Segmented Pill for Conversations */}
        <header
          className={`relative flex h-16 shrink-0 items-center justify-center px-4 sm:px-8 ${
            activeNav === 'conversations'
              ? isDark
                ? 'border-b border-[#16281D]/70 bg-[#060E09]'
                : 'border-b border-[#E6E3D8] bg-[#FAF8F2]'
              : isDark
              ? 'border-b border-[#16281D] bg-[#060E09] lg:hidden'
              : 'border-b border-[#E6E3D8] bg-[#FAF8F2] lg:hidden'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className={`absolute left-4 flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden ${
              isDark
                ? 'border-[#1E3628] bg-[#0D1C13] text-white'
                : 'border-[#DCD9CD] bg-white text-[#10281B]'
            }`}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          {activeNav === 'conversations' ? (
            <div
              role="tablist"
              aria-label="Conversation mode"
              className={`inline-flex items-center rounded-full border p-1 ${
                isDark
                  ? 'border-[#1E3A29] bg-[#0B1710]'
                  : 'border-[#D8D5C9] bg-[#EFECE3]'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={conversationMode === 'queue-ai'}
                onClick={() => handleSwitchConversationMode('queue-ai')}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors sm:px-5 ${
                  conversationMode === 'queue-ai'
                    ? isDark
                      ? 'bg-[#1D5434] text-white'
                      : 'bg-[#1B4332] text-white'
                    : isDark
                    ? 'text-[#9CB3A4] hover:text-white'
                    : 'text-[#4B6356] hover:text-[#10281B]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Queue AI</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={conversationMode === 'desk-chat'}
                onClick={() => handleSwitchConversationMode('desk-chat')}
                className={`relative inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors sm:px-5 ${
                  conversationMode === 'desk-chat'
                    ? isDark
                      ? 'bg-[#1D5434] text-white'
                      : 'bg-[#1B4332] text-white'
                    : isDark
                    ? 'text-[#9CB3A4] hover:text-white'
                    : 'text-[#4B6356] hover:text-[#10281B]'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Desk Chat</span>
                {nexconnState.unreadCount + relayUnreadCount > 0 && (
                  <span
                    aria-label={`${nexconnState.unreadCount + relayUnreadCount} unread desk messages`}
                    className={`h-2 w-2 rounded-full ${
                      isDark ? 'bg-[#6EE7A0]' : 'bg-[#22A35C]'
                    }`}
                  />
                )}
              </button>
            </div>
          ) : (
            <span
              className={`font-display text-sm font-bold lg:hidden ${
                isDark ? 'text-white' : 'text-[#10281B]'
              }`}
            >
              {activeNav === 'tickets' ? 'My Tickets' : 'Profile'}
            </span>
          )}
        </header>

        {/* Active View Body */}
        {activeNav === 'conversations' && conversationMode === 'queue-ai' && (
          <VisitorQueueAI
            visitorTheme={visitorTheme}
            branches={branches}
            messages={queueAIMessages}
            onSetMessages={setQueueAIMessages}
            draft={queueAIDraft}
            onSetDraft={setQueueAIDraft}
            pendingIntent={queueAIPendingIntent}
            onSetPendingIntent={setQueueAIPendingIntent}
            bookingForm={queueAIBookingForm}
            onSetBookingForm={setQueueAIBookingForm}
            tickets={myTickets}
            getTicketPosition={getTicketPosition}
            onConfirmBooking={handleConfirmBooking}
            onOpenDeskChatForBranch={handleOpenDeskChatForBranch}
          />
        )}

        {activeNav === 'conversations' && conversationMode === 'desk-chat' && (
          <VisitorDeskChat
            visitorTheme={visitorTheme}
            displayName={displayName}
            activeVisitorUid={activeVisitorUid}
            branches={branches}
            activeTickets={activeTickets}
            allMyTickets={myTickets}
            services={services}
            queueFeed={queueFeed}
            announcements={announcements}
            getTicketPosition={getTicketPosition}
            onLeaveQueue={leaveQueue}
            activeBranchKey={activeBranchKey}
            branchSessions={branchSessions}
            onSelectBranchSession={handleSelectBranchSession}
            onClearSelectedBranch={() => setActiveBranchKey(null)}
            onMarkBranchFirstTaggedSent={(branchKey) => {
              persistBranchSessions((prev) => {
                const target = prev[branchKey];
                if (!target || target.firstTaggedSent) return prev;
                return {
                  ...prev,
                  [branchKey]: { ...target, firstTaggedSent: true, updatedAt: Date.now() },
                };
              });
            }}
            draftByBranch={deskDraftByBranch}
            onSetDraftForBranch={(branchKey, text) =>
              setDeskDraftByBranch((prev) => ({ ...prev, [branchKey]: text }))
            }
            systemEvents={systemEvents}
            onSwitchToQueueAI={() => handleSwitchConversationMode('queue-ai')}
            nexconnState={nexconnState}
            branchMessages={activeBranchRelayMessages}
            onRelayBranchMessage={handleRelayBranchMessage}
            supportThreads={supportThreads}
            createSupportThread={createSupportThread}
            sendSupportMessage={sendSupportMessage}
            subscribeToThreadMessages={subscribeToThreadMessages}
          />
        )}

        {activeNav === 'tickets' && (
          <main className="flex-1 overflow-y-auto">
            <VisitorMyTickets
              visitorTheme={visitorTheme}
              activeTickets={activeTickets}
              pastTickets={pastTickets}
              ticketMetaMap={ticketMetaMap}
              getServiceById={getServiceById}
              getTicketPosition={getTicketPosition}
              onLeaveQueue={leaveQueue}
              onOpenDeskChatForTicket={handleOpenDeskChatForTicket}
              onGoToQueueAI={() => handleSwitchConversationMode('queue-ai')}
            />
          </main>
        )}

        {activeNav === 'profile' && (
          <main className="flex-1 overflow-y-auto">
            <VisitorProfile
              visitorTheme={visitorTheme}
              visitorUid={activeVisitorUid}
              displayName={displayName}
              displayEmail={displayEmail}
              avatarUrl={resolvedAvatarUrl}
              isDemoVisitor={isDemoVisitor}
              hasAuthenticatedUser={Boolean(user)}
              initialEmailOptIn={Boolean(profile?.emailNotificationsEnabled)}
              onUpdatePreferences={updatePreferences}
              onSignOut={() => void handleSignOut()}
            />
          </main>
        )}
      </div>
    </div>
  );
}
