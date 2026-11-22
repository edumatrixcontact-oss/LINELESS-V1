import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_SERVICES, STARTER_WALKIN_TICKETS } from '../data/seedData';
import {
  DEMO_QUEUE_STORAGE_KEY,
  DemoQueueState,
  createInitialDemoQueueState,
  loadDemoQueueState,
  saveDemoQueueState,
} from '../lib/demoQueueStore';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import {
  Announcement,
  BranchChatThreadMeta,
  NotificationItem,
  NotificationType,
  QueueFeedItem,
  ServiceLocation,
  StaffMember,
  SupportMessage,
  SupportThread,
  Ticket,
  TicketPositionInfo,
  UserProfile,
  UserRole,
  ViewMode,
} from '../types/queue';
import { DEMO_VISITOR_UID, useAuth } from './AuthContext';

export interface CreateServiceInput {
  name: string;
  facility: string;
  locationDetail: string;
  prefix: string;
  avgServiceMinutes: number;
  counters: string[];
}

export interface UpdateServiceInput {
  name?: string;
  facility?: string;
  locationDetail?: string;
  prefix?: string;
  avgServiceMinutes?: number;
  counters?: string[];
}

export interface UpsertBranchChatThreadInput {
  channelId: string;
  visitorUid: string;
  visitorName: string;
  branchKey: string;
  locationName: string;
  serviceId?: string | null;
  serviceName?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  reason?: string | null;
  unreadForStaffIncrement?: number;
  lastMessageText?: string;
  lastMessageAt?: number;
}

interface QueueContextValue {
  services: ServiceLocation[];
  queueFeed: QueueFeedItem[];
  tickets: Ticket[];
  announcements: Announcement[];
  rawAnnouncements: Announcement[];
  notifications: NotificationItem[];
  supportThreads: SupportThread[];
  branchChatThreads: BranchChatThreadMeta[];
  allUsers: UserProfile[];
  staffMembers: StaffMember[];
  loadingQueue: boolean;
  isDemoMode: boolean;
  unreadNotificationCount: number;
  joinQueue: (
    serviceId: string,
    visitorName?: string,
    demoCatalogSeed?: CreateServiceInput & { id: string },
    reason?: string
  ) => Promise<Ticket | null>;
  joinAnonymousQrQueue: (
    serviceId: string,
    visitorName?: string,
    demoCatalogSeed?: CreateServiceInput & { id: string }
  ) => Promise<Ticket | null>;
  leaveAnonymousQrTicket: (ticketId: string) => Promise<void>;
  leaveQueue: (ticketId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  createSupportThread: (
    serviceId: string | null,
    subject: string,
    messageText: string
  ) => Promise<string | null>;
  sendSupportMessage: (threadId: string, text: string) => Promise<void>;
  resolveSupportThread: (threadId: string) => Promise<void>;
  subscribeToThreadMessages: (
    threadId: string,
    onMessages: (msgs: SupportMessage[]) => void
  ) => () => void;
  // Branch-scoped Desk Chat thread metadata & live message relay
  upsertBranchChatThread: (input: UpsertBranchChatThreadInput) => BranchChatThreadMeta;
  markBranchChatThreadRead: (threadId: string) => void;
  sendBranchChatMessage: (params: {
    channelId: string;
    threadOwnerUid: string;
    senderUid: string;
    senderRole: UserRole;
    senderName: string;
    text: string;
  }) => SupportMessage | null;
  getBranchChatMessages: (channelId: string) => SupportMessage[];
  // Staff-only operations (enforced in UI, Demo Staff check, and Firestore security rules)
  seedInitialData: () => Promise<void>;
  createService: (input: CreateServiceInput) => Promise<ServiceLocation | null>;
  updateService: (serviceId: string, input: UpdateServiceInput) => Promise<void>;
  addWalkIn: (serviceId: string, visitorName?: string) => Promise<Ticket | null>;
  addTestDigitalTicket: (serviceId: string, visitorName?: string) => Promise<Ticket | null>;
  callNext: (serviceId: string, counterOverride?: string) => Promise<Ticket | null>;
  callSpecificTicket: (ticketId: string, counterOverride?: string) => Promise<void>;
  recallTicket: (ticketId: string) => Promise<void>;
  assignTicketCounter: (ticketId: string, counter: string) => Promise<void>;
  notifyTicketVisitor: (ticketId: string, customMessage?: string) => Promise<boolean>;
  markServing: (ticketId: string) => Promise<void>;
  completeTicket: (ticketId: string) => Promise<void>;
  deferTicket: (ticketId: string) => Promise<void>;
  requeueTicket: (ticketId: string) => Promise<void>;
  toggleServicePause: (serviceId: string) => Promise<void>;
  sendAnnouncement: (
    serviceId: string | 'all',
    message: string,
    expiresAt?: number | null
  ) => Promise<void>;
  clearAnnouncement: (announcementId: string) => Promise<void>;
  grantStaffAccess: (targetUser: UserProfile) => Promise<void>;
  revokeStaffAccess: (targetUid: string) => Promise<void>;
  resetDemoQueue: () => void;
  // Computed selectors
  getServiceById: (serviceId: string) => ServiceLocation | undefined;
  getTicketPosition: (ticketId: string) => TicketPositionInfo | null;
  getServiceEstimatedWait: (serviceId: string) => number;
  getWaitingFeedForService: (serviceId: string) => QueueFeedItem[];
}

const QueueContext = createContext<QueueContextValue | null>(null);

function tsToMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function nullableTsToMillis(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return null;
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pickCounterFromTickets(
  service: ServiceLocation,
  allTickets: Ticket[],
  counterOverride?: string
): string {
  if (counterOverride) return counterOverride;
  const busyCounters = new Set(
    allTickets
      .filter(
        (t) =>
          t.serviceId === service.id &&
          (t.status === 'called' || t.status === 'serving') &&
          t.counter
      )
      .map((t) => t.counter as string)
  );
  const freeCounter = service.counters.find((c) => !busyCounters.has(c));
  if (freeCounter) return freeCounter;
  const activeCount = allTickets.filter(
    (t) => t.serviceId === service.id && (t.status === 'called' || t.status === 'serving')
  ).length;
  return service.counters[activeCount % Math.max(1, service.counters.length)] || 'Counter 1';
}

export function QueueProvider({
  children,
  currentView = 'home',
}: {
  children: React.ReactNode;
  currentView?: ViewMode;
}) {
  const { user, profile, isStaff, isDemoStaff, isDemoVisitor, authReady } = useAuth();

  const isDemoMode =
    currentView === 'staff'
      ? isDemoStaff
      : currentView === 'visitor'
      ? isDemoVisitor
      : currentView === 'qr'
      ? !user
      : isDemoStaff || isDemoVisitor;

  // Firestore-backed live state
  const [fsServices, setFsServices] = useState<ServiceLocation[]>([]);
  const [fsQueueFeed, setFsQueueFeed] = useState<QueueFeedItem[]>([]);
  const [fsTickets, setFsTickets] = useState<Ticket[]>([]);
  const [fsAnnouncements, setFsAnnouncements] = useState<Announcement[]>([]);
  const [fsNotifications, setFsNotifications] = useState<NotificationItem[]>([]);
  const [fsSupportThreads, setFsSupportThreads] = useState<SupportThread[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [expiryTick, setExpiryTick] = useState(() => Date.now());

  // Local Prototype Demo Mode state
  const [demoState, setDemoState] = useState<DemoQueueState>(() => loadDemoQueueState());
  const demoStateRef = useRef<DemoQueueState>(demoState);
  demoStateRef.current = demoState;

  const demoThreadListenersRef = useRef<Map<string, Set<(msgs: SupportMessage[]) => void>>>(
    new Map()
  );

  const actionLocksRef = useRef<Set<string>>(new Set());
  const autoSeededRef = useRef(false);

  const activeDemoVisitorUid = DEMO_VISITOR_UID;
  const canOperateAsStaff =
    currentView === 'visitor' || currentView === 'qr'
      ? false
      : isDemoMode
      ? isDemoStaff
      : isStaff;

  useEffect(() => {
    const interval = window.setInterval(() => setExpiryTick(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const runWithActionLock = useCallback(async <T,>(lockKey: string, task: () => Promise<T>): Promise<T> => {
    if (actionLocksRef.current.has(lockKey)) {
      throw new Error('Action already in progress.');
    }
    actionLocksRef.current.add(lockKey);
    try {
      return await task();
    } finally {
      actionLocksRef.current.delete(lockKey);
    }
  }, []);

  const notifyDemoThreadSubscribers = useCallback((state: DemoQueueState) => {
    demoThreadListenersRef.current.forEach((listeners, threadId) => {
      const msgs = state.supportMessages[threadId] ?? [];
      listeners.forEach((cb) => cb(msgs));
    });
  }, []);

  const updateDemoState = useCallback(
    (updater: (prev: DemoQueueState) => DemoQueueState) => {
      const next = updater(demoStateRef.current);
      demoStateRef.current = next;
      saveDemoQueueState(next);
      setDemoState(next);
      notifyDemoThreadSubscribers(next);
      return next;
    },
    [notifyDemoThreadSubscribers]
  );

  // Sync demo state across browser tabs (e.g., Staff in tab 1 & Public Display in tab 2)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DEMO_QUEUE_STORAGE_KEY) {
        const reloaded = loadDemoQueueState();
        demoStateRef.current = reloaded;
        setDemoState(reloaded);
        notifyDemoThreadSubscribers(reloaded);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [notifyDemoThreadSubscribers]);

  // 1. Public Firestore listeners (Services, Non-PII Queue Feed, Announcements)
  useEffect(() => {
    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        const list: ServiceLocation[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: data.id,
              name: data.name,
              facility: data.facility,
              locationDetail: data.locationDetail,
              prefix: data.prefix,
              avgServiceMinutes: Number(data.avgServiceMinutes) || 6,
              counters: Array.isArray(data.counters) ? data.counters : ['Counter 1'],
              isPaused: Boolean(data.isPaused),
              nextSequence: Number(data.nextSequence) || 101,
              updatedAt: tsToMillis(data.updatedAt),
            };
          })
          .sort((a, b) => a.prefix.localeCompare(b.prefix));
        setFsServices(list);
        setLoadingServices(false);
      },
      (err) => {
        setLoadingServices(false);
        handleFirestoreError(err, OperationType.LIST, 'services');
      }
    );

    const unsubFeed = onSnapshot(
      collection(db, 'queueFeed'),
      (snap) => {
        const list: QueueFeedItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ticketNumber: data.ticketNumber,
            serviceId: data.serviceId,
            status: data.status,
            counter: data.counter ?? null,
            createdAt: tsToMillis(data.createdAt),
            queueOrderAt: tsToMillis(data.queueOrderAt),
            updatedAt: tsToMillis(data.updatedAt),
            calledAt: nullableTsToMillis(data.calledAt),
            completedAt: nullableTsToMillis(data.completedAt),
          };
        });
        setFsQueueFeed(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'queueFeed');
      }
    );

    const unsubAnnouncements = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list: Announcement[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            serviceId: data.serviceId,
            message: data.message,
            authorUid: data.authorUid,
            createdAt: tsToMillis(data.createdAt),
            expiresAt: nullableTsToMillis(data.expiresAt),
          };
        });
        setFsAnnouncements(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'announcements');
      }
    );

    return () => {
      unsubServices();
      unsubFeed();
      unsubAnnouncements();
    };
  }, []);

  // 2. Role-scoped private Firestore listeners (only attached once Auth is ready)
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setFsTickets([]);
      setFsNotifications([]);
      setFsSupportThreads([]);
      setAllUsers([]);
      setStaffMembers([]);
      return;
    }

    const ticketsQuery = isStaff
      ? collection(db, 'tickets')
      : query(collection(db, 'tickets'), where('userId', '==', user.uid));

    const unsubTickets = onSnapshot(
      ticketsQuery,
      (snap) => {
        const list: Ticket[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ticketNumber: data.ticketNumber,
            serviceId: data.serviceId,
            visitorName: data.visitorName,
            userId: data.userId ?? null,
            channel: data.channel,
            status: data.status,
            counter: data.counter ?? null,
            reason: typeof data.reason === 'string' ? data.reason : undefined,
            sessionType: 'authenticated',
            createdAt: tsToMillis(data.createdAt),
            queueOrderAt: tsToMillis(data.queueOrderAt),
            updatedAt: tsToMillis(data.updatedAt),
            calledAt: nullableTsToMillis(data.calledAt),
            completedAt: nullableTsToMillis(data.completedAt),
          };
        });
        setFsTickets(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tickets');
      }
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', user.uid)),
      (snap) => {
        const list: NotificationItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: data.id,
              userId: data.userId,
              ticketId: data.ticketId ?? null,
              ticketNumber: data.ticketNumber ?? null,
              type: data.type,
              title: data.title,
              body: data.body,
              read: Boolean(data.read),
              emailStatus: data.emailStatus ?? 'provider_not_configured',
              createdAt: tsToMillis(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt);
        setFsNotifications(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );

    const threadsQuery = isStaff
      ? collection(db, 'supportThreads')
      : query(collection(db, 'supportThreads'), where('userId', '==', user.uid));

    const unsubThreads = onSnapshot(
      threadsQuery,
      (snap) => {
        const list: SupportThread[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: data.id,
              userId: data.userId,
              visitorName: data.visitorName,
              serviceId: data.serviceId ?? null,
              subject: data.subject,
              status: data.status,
              lastMessageText: data.lastMessageText,
              createdAt: tsToMillis(data.createdAt),
              updatedAt: tsToMillis(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setFsSupportThreads(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'supportThreads');
      }
    );

    let unsubUsers: (() => void) | null = null;
    let unsubStaff: (() => void) | null = null;

    if (isStaff) {
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const list: UserProfile[] = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                uid: data.uid,
                name: data.name,
                email: data.email,
                role: data.role,
                emailNotificationsEnabled: Boolean(data.emailNotificationsEnabled),
                createdAt: tsToMillis(data.createdAt),
                updatedAt: tsToMillis(data.updatedAt),
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
          setAllUsers(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'users');
        }
      );

      unsubStaff = onSnapshot(
        collection(db, 'staff'),
        (snap) => {
          const list: StaffMember[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: data.uid,
              email: data.email,
              name: data.name,
              grantedBy: data.grantedBy,
              createdAt: tsToMillis(data.createdAt),
            };
          });
          setStaffMembers(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'staff');
        }
      );
    } else {
      setAllUsers([]);
      setStaffMembers([]);
    }

    return () => {
      unsubTickets();
      unsubNotifications();
      unsubThreads();
      if (unsubUsers) unsubUsers();
      if (unsubStaff) unsubStaff();
    };
  }, [authReady, user, isStaff]);

  // Unified exposed data (Demo Mode uses unified local prototype store; Live Mode uses Firestore)
  const services = useMemo(() => {
    if (isDemoMode) {
      return [...demoState.services].sort((a, b) => a.prefix.localeCompare(b.prefix));
    }
    return fsServices;
  }, [isDemoMode, demoState.services, fsServices]);

  const queueFeed = useMemo<QueueFeedItem[]>(() => {
    if (isDemoMode) {
      return demoState.tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        serviceId: t.serviceId,
        status: t.status,
        counter: t.counter,
        createdAt: t.createdAt,
        queueOrderAt: t.queueOrderAt,
        updatedAt: t.updatedAt,
        calledAt: t.calledAt,
        completedAt: t.completedAt,
      }));
    }
    return fsQueueFeed;
  }, [isDemoMode, demoState.tickets, fsQueueFeed]);

  const tickets = useMemo(() => {
    if (isDemoMode) {
      const tagged = demoState.tickets.map((t) => ({ ...t, sessionType: 'demo' as const }));
      if (canOperateAsStaff) return tagged;
      return tagged.filter((t) => t.userId === activeDemoVisitorUid);
    }
    return fsTickets;
  }, [isDemoMode, canOperateAsStaff, demoState.tickets, activeDemoVisitorUid, fsTickets]);

  const rawAnnouncements = useMemo(() => {
    if (isDemoMode) {
      return [...demoState.announcements].sort((a, b) => b.createdAt - a.createdAt);
    }
    return fsAnnouncements;
  }, [isDemoMode, demoState.announcements, fsAnnouncements]);

  const announcements = useMemo(() => {
    return rawAnnouncements.filter((a) => !a.expiresAt || a.expiresAt > expiryTick);
  }, [rawAnnouncements, expiryTick]);

  const notifications = useMemo(() => {
    if (isDemoMode) {
      return demoState.notifications
        .filter((n) => n.userId === activeDemoVisitorUid)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    return fsNotifications;
  }, [isDemoMode, demoState.notifications, activeDemoVisitorUid, fsNotifications]);

  const supportThreads = useMemo(() => {
    if (isDemoMode) {
      const list = canOperateAsStaff
        ? demoState.supportThreads
        : demoState.supportThreads.filter((t) => t.userId === activeDemoVisitorUid);
      return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return fsSupportThreads;
  }, [isDemoMode, canOperateAsStaff, demoState.supportThreads, activeDemoVisitorUid, fsSupportThreads]);

  const branchChatThreads = useMemo(() => {
    return [...(demoState.branchChatThreads || [])].sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
  }, [demoState.branchChatThreads]);

  // Seed initial service locations & starter walk-in queue
  const seedInitialData = useCallback(async () => {
    if (isDemoMode) {
      if (!canOperateAsStaff) return;
      updateDemoState((prev) => {
        if (prev.services.length > 0) return prev;
        return createInitialDemoQueueState();
      });
      return;
    }

    if (!user || !isStaff) return;
    try {
      const existingServices = await getDocs(collection(db, 'services'));
      if (!existingServices.empty) return;

      const batch = writeBatch(db);
      for (const svc of DEFAULT_SERVICES) {
        batch.set(doc(db, 'services', svc.id), {
          id: svc.id,
          name: svc.name,
          facility: svc.facility,
          locationDetail: svc.locationDetail,
          prefix: svc.prefix,
          avgServiceMinutes: svc.avgServiceMinutes,
          counters: svc.counters,
          isPaused: false,
          nextSequence: svc.nextSequence,
          updatedAt: serverTimestamp(),
        });
      }

      for (const t of STARTER_WALKIN_TICKETS) {
        const ticketPayload = {
          id: t.id,
          ticketNumber: t.ticketNumber,
          serviceId: t.serviceId,
          visitorName: t.visitorName,
          userId: null,
          channel: 'walk-in',
          status: t.status,
          counter: t.counter,
          createdAt: serverTimestamp(),
          queueOrderAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          calledAt:
            t.status === 'called' || t.status === 'serving' || t.status === 'completed'
              ? serverTimestamp()
              : null,
          completedAt: t.status === 'completed' ? serverTimestamp() : null,
        };
        const feedPayload = {
          id: t.id,
          ticketNumber: t.ticketNumber,
          serviceId: t.serviceId,
          status: t.status,
          counter: t.counter,
          createdAt: serverTimestamp(),
          queueOrderAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          calledAt: ticketPayload.calledAt,
          completedAt: ticketPayload.completedAt,
        };
        batch.set(doc(db, 'tickets', t.id), ticketPayload);
        batch.set(doc(db, 'queueFeed', t.id), feedPayload);
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'services / tickets / queueFeed');
    }
  }, [isDemoMode, canOperateAsStaff, updateDemoState, user, isStaff]);

  useEffect(() => {
    if (
      !isDemoMode &&
      authReady &&
      isStaff &&
      !loadingServices &&
      fsServices.length === 0 &&
      !autoSeededRef.current
    ) {
      autoSeededRef.current = true;
      void seedInitialData();
    }
  }, [isDemoMode, authReady, isStaff, loadingServices, fsServices.length, seedInitialData]);

  // Create a new service / queue event
  const createService = useCallback(
    async (input: CreateServiceInput): Promise<ServiceLocation | null> => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }

      const name = input.name.trim().slice(0, 100);
      const facility = input.facility.trim().slice(0, 100);
      const locationDetail = input.locationDetail.trim().slice(0, 120);
      const prefix =
        input.prefix
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 4) || 'Q';
      const avgServiceMinutes = Math.max(
        1,
        Math.min(180, Math.round(Number(input.avgServiceMinutes) || 6))
      );
      const cleanCounters = input.counters
        .map((c) => c.trim().slice(0, 40))
        .filter((c) => c.length > 0)
        .slice(0, 10);
      const counters = cleanCounters.length > 0 ? cleanCounters : ['Counter 1'];

      if (!name || !facility || !locationDetail) {
        throw new Error('Service name, facility, and location detail are required.');
      }

      const serviceId = makeId('svc');
      const now = Date.now();
      const newService: ServiceLocation = {
        id: serviceId,
        name,
        facility,
        locationDetail,
        prefix,
        avgServiceMinutes,
        counters,
        isPaused: false,
        nextSequence: 101,
        updatedAt: now,
      };

      if (isDemoMode) {
        updateDemoState((prev) => ({
          ...prev,
          services: [...prev.services, newService],
        }));
        return newService;
      }

      if (!user || !isStaff) {
        throw new Error('Staff authorization required.');
      }

      try {
        await setDoc(doc(db, 'services', serviceId), {
          id: serviceId,
          name,
          facility,
          locationDetail,
          prefix,
          avgServiceMinutes,
          counters,
          isPaused: false,
          nextSequence: 101,
          updatedAt: serverTimestamp(),
        });
        return newService;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `services/${serviceId}`);
        return null;
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff]
  );

  // Update an existing service / counter configuration
  const updateService = useCallback(
    async (serviceId: string, input: UpdateServiceInput) => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }

      if (isDemoMode) {
        let errorToThrow: Error | null = null;
        updateDemoState((prev) => {
          const existing = prev.services.find((s) => s.id === serviceId);
          if (!existing) {
            errorToThrow = new Error('Service not found.');
            return prev;
          }
          const nextName =
            typeof input.name === 'string' && input.name.trim()
              ? input.name.trim().slice(0, 100)
              : existing.name;
          const nextFacility =
            typeof input.facility === 'string' && input.facility.trim()
              ? input.facility.trim().slice(0, 100)
              : existing.facility;
          const nextLocationDetail =
            typeof input.locationDetail === 'string' && input.locationDetail.trim()
              ? input.locationDetail.trim().slice(0, 120)
              : existing.locationDetail;
          const nextPrefix =
            typeof input.prefix === 'string' && input.prefix.trim()
              ? input.prefix
                  .trim()
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 4) || existing.prefix
              : existing.prefix;
          const nextAvg =
            input.avgServiceMinutes !== undefined
              ? Math.max(1, Math.min(180, Math.round(Number(input.avgServiceMinutes) || 6)))
              : existing.avgServiceMinutes;
          const nextCounters = Array.isArray(input.counters)
            ? input.counters
                .map((c) => c.trim().slice(0, 40))
                .filter((c) => c.length > 0)
                .slice(0, 10)
            : existing.counters;
          const sanitizedCounters = nextCounters.length > 0 ? nextCounters : existing.counters;
          const now = Date.now();
          return {
            ...prev,
            services: prev.services.map((s) =>
              s.id === serviceId
                ? {
                    ...s,
                    name: nextName,
                    facility: nextFacility,
                    locationDetail: nextLocationDetail,
                    prefix: nextPrefix,
                    avgServiceMinutes: nextAvg,
                    counters: sanitizedCounters,
                    updatedAt: now,
                  }
                : s
            ),
          };
        });
        if (errorToThrow) throw errorToThrow;
        return;
      }

      if (!user || !isStaff) {
        throw new Error('Staff authorization required.');
      }
      const existing = fsServices.find((s) => s.id === serviceId);
      if (!existing) throw new Error('Service not found.');

      const nextName =
        typeof input.name === 'string' && input.name.trim()
          ? input.name.trim().slice(0, 100)
          : existing.name;
      const nextFacility =
        typeof input.facility === 'string' && input.facility.trim()
          ? input.facility.trim().slice(0, 100)
          : existing.facility;
      const nextLocationDetail =
        typeof input.locationDetail === 'string' && input.locationDetail.trim()
          ? input.locationDetail.trim().slice(0, 120)
          : existing.locationDetail;
      const nextPrefix =
        typeof input.prefix === 'string' && input.prefix.trim()
          ? input.prefix
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 4) || existing.prefix
          : existing.prefix;
      const nextAvg =
        input.avgServiceMinutes !== undefined
          ? Math.max(1, Math.min(180, Math.round(Number(input.avgServiceMinutes) || 6)))
          : existing.avgServiceMinutes;
      const nextCounters = Array.isArray(input.counters)
        ? input.counters
            .map((c) => c.trim().slice(0, 40))
            .filter((c) => c.length > 0)
            .slice(0, 10)
        : existing.counters;
      const sanitizedCounters = nextCounters.length > 0 ? nextCounters : existing.counters;

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'services', serviceId), {
          name: nextName,
          facility: nextFacility,
          locationDetail: nextLocationDetail,
          prefix: nextPrefix,
          avgServiceMinutes: nextAvg,
          counters: sanitizedCounters,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsServices]
  );

  // Digital visitor joins a queue (accepts optional booking reason)
  const joinQueue = useCallback(
    async (
      serviceId: string,
      visitorName?: string,
      demoCatalogSeed?: CreateServiceInput & { id: string },
      reason?: string
    ): Promise<Ticket | null> => {
      const cleanReason = reason?.trim().slice(0, 300) || undefined;

      if (isDemoMode) {
        const cleanName = (visitorName?.trim() || 'Demo Visitor').slice(0, 80);

        let createdTicket: Ticket | null = null;
        let errorToThrow: Error | null = null;

        updateDemoState((prev) => {
          const now = Date.now();
          let nextServices = prev.services;
          let svc = prev.services.find((s) => s.id === serviceId);
          if (!svc && demoCatalogSeed && demoCatalogSeed.id === serviceId) {
            svc = {
              id: demoCatalogSeed.id,
              name: demoCatalogSeed.name.slice(0, 100),
              facility: demoCatalogSeed.facility.slice(0, 100),
              locationDetail: demoCatalogSeed.locationDetail.slice(0, 120),
              prefix: demoCatalogSeed.prefix.slice(0, 4) || 'Q',
              avgServiceMinutes: Math.max(1, demoCatalogSeed.avgServiceMinutes || 5),
              counters:
                demoCatalogSeed.counters.length > 0 ? demoCatalogSeed.counters : ['Counter 1'],
              isPaused: false,
              nextSequence: 101,
              updatedAt: now,
            };
            nextServices = [...prev.services, svc];
          }

          if (!svc) {
            errorToThrow = new Error('Selected bank desk was not found.');
            return prev;
          }
          if (svc.isPaused) {
            errorToThrow = new Error(
              'This queue is currently paused and not accepting new joins.'
            );
            return prev;
          }

          const seq = svc.nextSequence || 101;
          const ticketNumber = `${svc.prefix}-${seq}`;
          const ticketId = makeId('tk');
          const notifId = makeId('ntf');

          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: activeDemoVisitorUid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            reason: cleanReason,
            sessionType: 'demo',
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };

          const notif: NotificationItem = {
            id: notifId,
            userId: activeDemoVisitorUid,
            ticketId,
            ticketNumber,
            type: 'ticket_joined',
            title: `Ticket ${ticketNumber} confirmed`,
            body: `You joined the queue for ${svc.name} at ${svc.facility}.`,
            read: false,
            emailStatus: 'provider_not_configured',
            createdAt: now,
          };

          return {
            ...prev,
            services: nextServices.map((s) =>
              s.id === serviceId ? { ...s, nextSequence: seq + 1, updatedAt: now } : s
            ),
            tickets: [...prev.tickets, createdTicket],
            notifications: [notif, ...prev.notifications],
          };
        });

        if (errorToThrow) throw errorToThrow;
        return createdTicket;
      }

      if (!user) throw new Error('You must sign in to join a queue.');
      const cleanName = (
        visitorName?.trim() ||
        profile?.name ||
        user.displayName ||
        'Visitor'
      ).slice(0, 80);

      const ticketId = makeId('tk');
      const notifId = makeId('ntf');
      let createdTicket: Ticket | null = null;

      try {
        await runTransaction(db, async (transaction) => {
          const svcRef = doc(db, 'services', serviceId);
          const svcSnap = await transaction.get(svcRef);
          if (!svcSnap.exists()) {
            throw new Error('Selected bank desk was not found.');
          }
          const svcData = svcSnap.data();
          if (svcData.isPaused) {
            throw new Error('This queue is currently paused and not accepting new joins.');
          }

          const seq = Number(svcData.nextSequence) || 101;
          const ticketNumber = `${svcData.prefix}-${seq}`;

          transaction.update(svcRef, {
            nextSequence: seq + 1,
            updatedAt: serverTimestamp(),
          });

          const ticketRef = doc(db, 'tickets', ticketId);
          const feedRef = doc(db, 'queueFeed', ticketId);
          const notifRef = doc(db, 'notifications', notifId);

          const ticketWrite: Record<string, unknown> = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: user.uid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          };
          if (cleanReason) {
            ticketWrite.reason = cleanReason;
          }

          transaction.set(ticketRef, ticketWrite);

          transaction.set(feedRef, {
            id: ticketId,
            ticketNumber,
            serviceId,
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          });

          transaction.set(notifRef, {
            id: notifId,
            userId: user.uid,
            ticketId,
            ticketNumber,
            type: 'ticket_joined',
            title: `Ticket ${ticketNumber} confirmed`,
            body: `You joined the queue for ${svcData.name} at ${svcData.facility}.`,
            read: false,
            emailStatus: profile?.emailNotificationsEnabled
              ? 'provider_not_configured'
              : 'disabled',
            createdAt: serverTimestamp(),
          });

          const now = Date.now();
          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: user.uid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            reason: cleanReason,
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes('paused') || err.message.includes('not found'))
        ) {
          throw err;
        }
        handleFirestoreError(err, OperationType.WRITE, `tickets/${ticketId}`);
      }

      return createdTicket;
    },
    [isDemoMode, profile, user, updateDemoState, activeDemoVisitorUid]
  );

  // Anonymous QR walk-in joins the shared live queue directly without requiring login
  const joinAnonymousQrQueue = useCallback(
    async (
      serviceId: string,
      visitorName?: string,
      demoCatalogSeed?: CreateServiceInput & { id: string }
    ): Promise<Ticket | null> => {
      const cleanName = (visitorName?.trim() || 'Walk-in').slice(0, 80);
      let createdTicket: Ticket | null = null;
      let errorToThrow: Error | null = null;

      updateDemoState((prev) => {
        const now = Date.now();
        let nextServices = prev.services;
        let svc = prev.services.find((s) => s.id === serviceId);
        if (!svc && demoCatalogSeed && demoCatalogSeed.id === serviceId) {
          svc = {
            id: demoCatalogSeed.id,
            name: demoCatalogSeed.name.slice(0, 100),
            facility: demoCatalogSeed.facility.slice(0, 100),
            locationDetail: demoCatalogSeed.locationDetail.slice(0, 120),
            prefix: demoCatalogSeed.prefix.slice(0, 4) || 'B',
            avgServiceMinutes: Math.max(1, demoCatalogSeed.avgServiceMinutes || 6),
            counters:
              demoCatalogSeed.counters.length > 0 ? demoCatalogSeed.counters : ['Counter 1'],
            isPaused: false,
            nextSequence: 101,
            updatedAt: now,
          };
          nextServices = [...prev.services, svc];
        }

        if (!svc) {
          errorToThrow = new Error('Selected branch desk was not found.');
          return prev;
        }
        if (svc.isPaused) {
          errorToThrow = new Error('Queue paused. This desk is temporarily paused.');
          return prev;
        }

        const seq = svc.nextSequence || 101;
        const ticketNumber = `${svc.prefix}-${seq}`;
        const ticketId = makeId('qr');

        createdTicket = {
          id: ticketId,
          ticketNumber,
          serviceId,
          visitorName: cleanName,
          userId: null,
          channel: 'walk-in',
          status: 'waiting',
          counter: null,
          reason: 'QR walk-in',
          sessionType: 'demo',
          createdAt: now,
          queueOrderAt: now,
          updatedAt: now,
          calledAt: null,
          completedAt: null,
        };

        return {
          ...prev,
          services: nextServices.map((s) =>
            s.id === serviceId ? { ...s, nextSequence: seq + 1, updatedAt: now } : s
          ),
          tickets: [...prev.tickets, createdTicket],
        };
      });

      if (errorToThrow) throw errorToThrow;
      return createdTicket;
    },
    [updateDemoState]
  );

  // Anonymous QR walk-in cancels their own walk-in ticket
  const leaveAnonymousQrTicket = useCallback(
    async (ticketId: string) => {
      const now = Date.now();
      updateDemoState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) =>
          t.id === ticketId && t.channel === 'walk-in' && t.userId === null
            ? { ...t, status: 'cancelled', counter: null, updatedAt: now }
            : t
        ),
      }));
    },
    [updateDemoState]
  );

  // Visitor leaves their own waiting ticket
  const leaveQueue = useCallback(
    async (ticketId: string) => {
      if (isDemoMode) {
        const now = Date.now();
        updateDemoState((prev) => ({
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.id === ticketId && t.userId === activeDemoVisitorUid
              ? { ...t, status: 'cancelled', counter: null, updatedAt: now }
              : t
          ),
        }));
        return;
      }

      if (!user) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'tickets', ticketId), {
          status: 'cancelled',
          counter: null,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'queueFeed', ticketId), {
          status: 'cancelled',
          counter: null,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [isDemoMode, updateDemoState, activeDemoVisitorUid, user]
  );

  // Staff adds walk-in guest
  const addWalkIn = useCallback(
    async (serviceId: string, visitorName = ''): Promise<Ticket | null> => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }
      const cleanName = (visitorName.trim() || 'Walk-in Guest').slice(0, 80);

      if (isDemoMode) {
        let createdTicket: Ticket | null = null;
        let errorToThrow: Error | null = null;
        updateDemoState((prev) => {
          const svc = prev.services.find((s) => s.id === serviceId);
          if (!svc) {
            errorToThrow = new Error('Service not found.');
            return prev;
          }
          const now = Date.now();
          const seq = svc.nextSequence || 101;
          const ticketNumber = `${svc.prefix}-${seq}`;
          const ticketId = makeId('wk');

          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: null,
            channel: 'walk-in',
            status: 'waiting',
            counter: null,
            sessionType: 'demo',
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };

          return {
            ...prev,
            services: prev.services.map((s) =>
              s.id === serviceId ? { ...s, nextSequence: seq + 1, updatedAt: now } : s
            ),
            tickets: [...prev.tickets, createdTicket],
          };
        });
        if (errorToThrow) throw errorToThrow;
        return createdTicket;
      }

      if (!user || !isStaff) {
        throw new Error('Staff authorization required.');
      }
      const ticketId = makeId('wk');
      let createdTicket: Ticket | null = null;

      try {
        await runTransaction(db, async (transaction) => {
          const svcRef = doc(db, 'services', serviceId);
          const svcSnap = await transaction.get(svcRef);
          if (!svcSnap.exists()) throw new Error('Service not found.');
          const svcData = svcSnap.data();
          const seq = Number(svcData.nextSequence) || 101;
          const ticketNumber = `${svcData.prefix}-${seq}`;

          transaction.update(svcRef, {
            nextSequence: seq + 1,
            updatedAt: serverTimestamp(),
          });

          transaction.set(doc(db, 'tickets', ticketId), {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: null,
            channel: 'walk-in',
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          });

          transaction.set(doc(db, 'queueFeed', ticketId), {
            id: ticketId,
            ticketNumber,
            serviceId,
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          });

          const now = Date.now();
          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: null,
            channel: 'walk-in',
            status: 'waiting',
            counter: null,
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tickets/${ticketId}`);
      }

      return createdTicket;
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff]
  );

  // Staff creates a test digital app ticket (immediately visible in Staff Queue, Visitor Dashboard & Public Display)
  const addTestDigitalTicket = useCallback(
    async (serviceId: string, visitorName = ''): Promise<Ticket | null> => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }
      const cleanName = (visitorName.trim() || 'Test Digital Visitor').slice(0, 80);

      if (isDemoMode) {
        let createdTicket: Ticket | null = null;
        let errorToThrow: Error | null = null;

        updateDemoState((prev) => {
          const svc = prev.services.find((s) => s.id === serviceId);
          if (!svc) {
            errorToThrow = new Error('Service not found.');
            return prev;
          }
          const now = Date.now();
          const seq = svc.nextSequence || 101;
          const ticketNumber = `${svc.prefix}-${seq}`;
          const ticketId = makeId('tk');
          const notifId = makeId('ntf');

          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: activeDemoVisitorUid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            sessionType: 'demo',
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };

          const notif: NotificationItem = {
            id: notifId,
            userId: activeDemoVisitorUid,
            ticketId,
            ticketNumber,
            type: 'ticket_joined',
            title: `Test ticket ${ticketNumber} created`,
            body: `Digital ticket added to ${svc.name} at ${svc.facility}.`,
            read: false,
            emailStatus: 'provider_not_configured',
            createdAt: now,
          };

          return {
            ...prev,
            services: prev.services.map((s) =>
              s.id === serviceId ? { ...s, nextSequence: seq + 1, updatedAt: now } : s
            ),
            tickets: [...prev.tickets, createdTicket],
            notifications: [notif, ...prev.notifications],
          };
        });

        if (errorToThrow) throw errorToThrow;
        return createdTicket;
      }

      if (!user || !isStaff) {
        throw new Error('Staff authorization required.');
      }
      const ticketId = makeId('tk');
      const notifId = makeId('ntf');
      let createdTicket: Ticket | null = null;

      try {
        await runTransaction(db, async (transaction) => {
          const svcRef = doc(db, 'services', serviceId);
          const svcSnap = await transaction.get(svcRef);
          if (!svcSnap.exists()) throw new Error('Service not found.');
          const svcData = svcSnap.data();
          const seq = Number(svcData.nextSequence) || 101;
          const ticketNumber = `${svcData.prefix}-${seq}`;

          transaction.update(svcRef, {
            nextSequence: seq + 1,
            updatedAt: serverTimestamp(),
          });

          transaction.set(doc(db, 'tickets', ticketId), {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: user.uid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          });

          transaction.set(doc(db, 'queueFeed', ticketId), {
            id: ticketId,
            ticketNumber,
            serviceId,
            status: 'waiting',
            counter: null,
            createdAt: serverTimestamp(),
            queueOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            calledAt: null,
            completedAt: null,
          });

          transaction.set(doc(db, 'notifications', notifId), {
            id: notifId,
            userId: user.uid,
            ticketId,
            ticketNumber,
            type: 'ticket_joined',
            title: `Test ticket ${ticketNumber} created`,
            body: `Digital ticket added to ${svcData.name} at ${svcData.facility}.`,
            read: false,
            emailStatus: 'provider_not_configured',
            createdAt: serverTimestamp(),
          });

          const now = Date.now();
          createdTicket = {
            id: ticketId,
            ticketNumber,
            serviceId,
            visitorName: cleanName,
            userId: user.uid,
            channel: 'digital',
            status: 'waiting',
            counter: null,
            createdAt: now,
            queueOrderAt: now,
            updatedAt: now,
            calledAt: null,
            completedAt: null,
          };
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tickets/${ticketId}`);
      }

      return createdTicket;
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, activeDemoVisitorUid, user, isStaff]
  );

  const queueNotificationInBatch = (
    batch: ReturnType<typeof writeBatch>,
    targetUserId: string,
    payload: {
      ticketId: string | null;
      ticketNumber: string | null;
      type: NotificationType;
      title: string;
      body: string;
    }
  ) => {
    const notifId = makeId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      userId: targetUserId,
      ticketId: payload.ticketId,
      ticketNumber: payload.ticketNumber,
      type: payload.type,
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 320),
      read: false,
      emailStatus: 'provider_not_configured',
      createdAt: serverTimestamp(),
    });
  };

  const callSpecificTicket = useCallback(
    async (ticketId: string, counterOverride?: string) => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }

      return runWithActionLock(`call_${ticketId}`, async () => {
        if (isDemoMode) {
          updateDemoState((prev) => {
            const target = prev.tickets.find((t) => t.id === ticketId);
            if (!target) return prev;
            const service = prev.services.find((s) => s.id === target.serviceId);
            if (!service) return prev;

            const assignedCounter = pickCounterFromTickets(service, prev.tickets, counterOverride);
            const now = Date.now();
            const nextNotifs = [...prev.notifications];

            if (target.userId) {
              nextNotifs.unshift({
                id: makeId('ntf'),
                userId: target.userId,
                ticketId: target.id,
                ticketNumber: target.ticketNumber,
                type: 'ticket_called',
                title: `Ticket ${target.ticketNumber} called to ${assignedCounter}`,
                body: `It's your turn for ${service.name}. Please proceed to ${assignedCounter}.`,
                read: false,
                emailStatus: 'provider_not_configured',
                createdAt: now,
              });
            }

            return {
              ...prev,
              tickets: prev.tickets.map((t) =>
                t.id === ticketId
                  ? {
                      ...t,
                      status: 'called',
                      counter: assignedCounter,
                      calledAt: now,
                      updatedAt: now,
                    }
                  : t
              ),
              notifications: nextNotifs,
            };
          });
          return;
        }

        if (!user || !isStaff) {
          throw new Error('Staff authorization required.');
        }
        const target = fsTickets.find((t) => t.id === ticketId);
        if (!target) throw new Error('Ticket not found.');
        const service = fsServices.find((s) => s.id === target.serviceId);
        if (!service) throw new Error('Desk service not found.');

        const assignedCounter = pickCounterFromTickets(service, fsTickets, counterOverride);
        try {
          const batch = writeBatch(db);
          const updateFields = {
            status: 'called',
            counter: assignedCounter,
            calledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          batch.update(doc(db, 'tickets', ticketId), updateFields);
          batch.update(doc(db, 'queueFeed', ticketId), updateFields);

          if (target.userId) {
            queueNotificationInBatch(batch, target.userId, {
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              type: 'ticket_called',
              title: `Ticket ${target.ticketNumber} called to ${assignedCounter}`,
              body: `It's your turn for ${service.name}. Please proceed to ${assignedCounter}.`,
            });
          }

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
        }
      });
    },
    [canOperateAsStaff, runWithActionLock, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const callNext = useCallback(
    async (serviceId: string, counterOverride?: string): Promise<Ticket | null> => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }
      return runWithActionLock(`call_next_${serviceId}`, async () => {
        const sourceTickets = isDemoMode ? demoStateRef.current.tickets : fsTickets;
        const waiting = sourceTickets
          .filter((t) => t.serviceId === serviceId && t.status === 'waiting')
          .sort((a, b) => a.queueOrderAt - b.queueOrderAt);

        if (waiting.length === 0) return null;
        const nextTarget = waiting[0];
        await callSpecificTicket(nextTarget.id, counterOverride);
        return nextTarget;
      });
    },
    [canOperateAsStaff, runWithActionLock, isDemoMode, fsTickets, callSpecificTicket]
  );

  const recallTicket = useCallback(
    async (ticketId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const target = prev.tickets.find((t) => t.id === ticketId);
          if (!target) return prev;
          const service = prev.services.find((s) => s.id === target.serviceId);
          const now = Date.now();
          const nextNotifs = [...prev.notifications];
          if (target.userId) {
            nextNotifs.unshift({
              id: makeId('ntf'),
              userId: target.userId,
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              type: 'ticket_called',
              title: `Reminder: ${target.ticketNumber} called to ${target.counter ?? 'desk'}`,
              body: `Staff recalled your ticket for ${service?.name ?? 'your visit'}. Please step forward.`,
              read: false,
              emailStatus: 'provider_not_configured',
              createdAt: now,
            });
          }
          return {
            ...prev,
            tickets: prev.tickets.map((t) =>
              t.id === ticketId ? { ...t, status: 'called', calledAt: now, updatedAt: now } : t
            ),
            notifications: nextNotifs,
          };
        });
        return;
      }

      if (!user || !isStaff) return;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const service = fsServices.find((s) => s.id === target.serviceId);

      try {
        const batch = writeBatch(db);
        const updateFields = {
          status: 'called',
          calledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);

        if (target.userId) {
          queueNotificationInBatch(batch, target.userId, {
            ticketId: target.id,
            ticketNumber: target.ticketNumber,
            type: 'ticket_called',
            title: `Reminder: ${target.ticketNumber} called to ${target.counter ?? 'desk'}`,
            body: `Staff recalled your ticket for ${service?.name ?? 'your visit'}. Please step forward.`,
          });
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const assignTicketCounter = useCallback(
    async (ticketId: string, counter: string) => {
      if (!canOperateAsStaff) return;
      const cleanCounter = counter.trim().slice(0, 40);
      if (!cleanCounter) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const target = prev.tickets.find((t) => t.id === ticketId);
          if (!target) return prev;
          const service = prev.services.find((s) => s.id === target.serviceId);
          const now = Date.now();
          const nextNotifs = [...prev.notifications];
          if (target.userId) {
            nextNotifs.unshift({
              id: makeId('ntf'),
              userId: target.userId,
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              type: 'counter_assigned',
              title: `${target.ticketNumber} assigned to ${cleanCounter}`,
              body: `Your ticket for ${service?.name ?? 'this service'} is assigned to ${cleanCounter}.`,
              read: false,
              emailStatus: 'provider_not_configured',
              createdAt: now,
            });
          }
          return {
            ...prev,
            tickets: prev.tickets.map((t) =>
              t.id === ticketId ? { ...t, counter: cleanCounter, updatedAt: now } : t
            ),
            notifications: nextNotifs,
          };
        });
        return;
      }

      if (!user || !isStaff) return;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const service = fsServices.find((s) => s.id === target.serviceId);

      try {
        const batch = writeBatch(db);
        const updateFields = {
          counter: cleanCounter,
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);
        if (target.userId) {
          queueNotificationInBatch(batch, target.userId, {
            ticketId: target.id,
            ticketNumber: target.ticketNumber,
            type: 'counter_assigned',
            title: `${target.ticketNumber} assigned to ${cleanCounter}`,
            body: `Your ticket for ${service?.name ?? 'this service'} is assigned to ${cleanCounter}.`,
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const notifyTicketVisitor = useCallback(
    async (ticketId: string, customMessage?: string): Promise<boolean> => {
      if (!canOperateAsStaff) return false;

      if (isDemoMode) {
        let sent = false;
        updateDemoState((prev) => {
          const target = prev.tickets.find((t) => t.id === ticketId);
          if (!target || !target.userId) return prev;
          const service = prev.services.find((s) => s.id === target.serviceId);
          const now = Date.now();
          sent = true;
          const title = `Queue update for ${target.ticketNumber}`;
          const body =
            customMessage?.trim().slice(0, 320) ||
            `Staff sent a notification for your ${service?.name ?? 'queue'} ticket (${target.ticketNumber})${
              target.counter ? ` at ${target.counter}` : ''
            }.`;
          return {
            ...prev,
            notifications: [
              {
                id: makeId('ntf'),
                userId: target.userId,
                ticketId: target.id,
                ticketNumber: target.ticketNumber,
                type: target.status === 'called' ? 'ticket_called' : 'announcement',
                title,
                body,
                read: false,
                emailStatus: 'provider_not_configured',
                createdAt: now,
              },
              ...prev.notifications,
            ],
          };
        });
        return sent;
      }

      if (!user || !isStaff) return false;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target || !target.userId) return false;
      const service = fsServices.find((s) => s.id === target.serviceId);

      try {
        const batch = writeBatch(db);
        queueNotificationInBatch(batch, target.userId, {
          ticketId: target.id,
          ticketNumber: target.ticketNumber,
          type: target.status === 'called' ? 'ticket_called' : 'announcement',
          title: `Queue update for ${target.ticketNumber}`,
          body:
            customMessage?.trim().slice(0, 320) ||
            `Staff sent a notification for your ${service?.name ?? 'queue'} ticket (${target.ticketNumber})${
              target.counter ? ` at ${target.counter}` : ''
            }.`,
        });
        await batch.commit();
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'notifications');
        return false;
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const markServing = useCallback(
    async (ticketId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        const now = Date.now();
        updateDemoState((prev) => ({
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.id === ticketId
              ? { ...t, status: 'serving', calledAt: t.calledAt ?? now, updatedAt: now }
              : t
          ),
        }));
        return;
      }

      if (!user || !isStaff) return;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target) return;

      try {
        const batch = writeBatch(db);
        const updateFields: Record<string, unknown> = {
          status: 'serving',
          updatedAt: serverTimestamp(),
        };
        if (!target.calledAt) {
          updateFields.calledAt = serverTimestamp();
        }
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets]
  );

  const completeTicket = useCallback(
    async (ticketId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const target = prev.tickets.find((t) => t.id === ticketId);
          if (!target) return prev;
          const service = prev.services.find((s) => s.id === target.serviceId);
          const now = Date.now();
          const nextNotifs = [...prev.notifications];
          if (target.userId) {
            nextNotifs.unshift({
              id: makeId('ntf'),
              userId: target.userId,
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              type: 'ticket_completed',
              title: `Visit completed (${target.ticketNumber})`,
              body: `Your visit for ${service?.name ?? 'this service'} has been marked complete.`,
              read: false,
              emailStatus: 'provider_not_configured',
              createdAt: now,
            });
          }
          return {
            ...prev,
            tickets: prev.tickets.map((t) =>
              t.id === ticketId
                ? { ...t, status: 'completed', completedAt: now, updatedAt: now }
                : t
            ),
            notifications: nextNotifs,
          };
        });
        return;
      }

      if (!user || !isStaff) return;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const service = fsServices.find((s) => s.id === target.serviceId);

      try {
        const batch = writeBatch(db);
        const updateFields = {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);

        if (target.userId) {
          queueNotificationInBatch(batch, target.userId, {
            ticketId: target.id,
            ticketNumber: target.ticketNumber,
            type: 'ticket_completed',
            title: `Visit completed (${target.ticketNumber})`,
            body: `Your visit for ${service?.name ?? 'this service'} has been marked complete.`,
          });
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const deferTicket = useCallback(
    async (ticketId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const target = prev.tickets.find((t) => t.id === ticketId);
          if (!target) return prev;
          const service = prev.services.find((s) => s.id === target.serviceId);
          const now = Date.now();
          const nextNotifs = [...prev.notifications];
          if (target.userId) {
            nextNotifs.unshift({
              id: makeId('ntf'),
              userId: target.userId,
              ticketId: target.id,
              ticketNumber: target.ticketNumber,
              type: 'ticket_deferred',
              title: `Ticket ${target.ticketNumber} deferred`,
              body: `Your ticket for ${service?.name ?? 'this queue'} was deferred. Speak with staff to be re-queued.`,
              read: false,
              emailStatus: 'provider_not_configured',
              createdAt: now,
            });
          }
          return {
            ...prev,
            tickets: prev.tickets.map((t) =>
              t.id === ticketId
                ? { ...t, status: 'deferred', counter: null, updatedAt: now }
                : t
            ),
            notifications: nextNotifs,
          };
        });
        return;
      }

      if (!user || !isStaff) return;
      const target = fsTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const service = fsServices.find((s) => s.id === target.serviceId);

      try {
        const batch = writeBatch(db);
        const updateFields = {
          status: 'deferred',
          counter: null,
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);

        if (target.userId) {
          queueNotificationInBatch(batch, target.userId, {
            ticketId: target.id,
            ticketNumber: target.ticketNumber,
            type: 'ticket_deferred',
            title: `Ticket ${target.ticketNumber} deferred`,
            body: `Your ticket for ${service?.name ?? 'this queue'} was deferred. Speak with staff to be re-queued.`,
          });
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsTickets, fsServices]
  );

  const requeueTicket = useCallback(
    async (ticketId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        const now = Date.now();
        updateDemoState((prev) => ({
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.id === ticketId
              ? { ...t, status: 'waiting', counter: null, queueOrderAt: now, updatedAt: now }
              : t
          ),
        }));
        return;
      }

      if (!user || !isStaff) return;
      try {
        const batch = writeBatch(db);
        const updateFields = {
          status: 'waiting',
          counter: null,
          queueOrderAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, 'tickets', ticketId), updateFields);
        batch.update(doc(db, 'queueFeed', ticketId), updateFields);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff]
  );

  const toggleServicePause = useCallback(
    async (serviceId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const svc = prev.services.find((s) => s.id === serviceId);
          if (!svc) return prev;
          const nextPaused = !svc.isPaused;
          const now = Date.now();
          const nextNotifs = [...prev.notifications];
          if (nextPaused) {
            const affectedUids = new Set(
              prev.tickets
                .filter(
                  (t) =>
                    t.serviceId === serviceId &&
                    t.status === 'waiting' &&
                    typeof t.userId === 'string' &&
                    t.userId.length > 0
                )
                .map((t) => t.userId as string)
            );
            for (const uid of affectedUids) {
              nextNotifs.unshift({
                id: makeId('ntf'),
                userId: uid,
                ticketId: null,
                ticketNumber: null,
                type: 'queue_delay',
                title: `${svc.name} queue paused`,
                body: `The ${svc.name} queue is temporarily paused. Your spot remains saved.`,
                read: false,
                emailStatus: 'provider_not_configured',
                createdAt: now,
              });
            }
          }
          return {
            ...prev,
            services: prev.services.map((s) =>
              s.id === serviceId ? { ...s, isPaused: nextPaused, updatedAt: now } : s
            ),
            notifications: nextNotifs,
          };
        });
        return;
      }

      if (!user || !isStaff) return;
      const svc = fsServices.find((s) => s.id === serviceId);
      if (!svc) return;

      const nextPaused = !svc.isPaused;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'services', serviceId), {
          isPaused: nextPaused,
          updatedAt: serverTimestamp(),
        });

        if (nextPaused) {
          const affectedUserIds = new Set(
            fsTickets
              .filter(
                (t) =>
                  t.serviceId === serviceId &&
                  t.status === 'waiting' &&
                  typeof t.userId === 'string' &&
                  t.userId.length > 0
              )
              .map((t) => t.userId as string)
          );
          for (const targetUid of affectedUserIds) {
            queueNotificationInBatch(batch, targetUid, {
              ticketId: null,
              ticketNumber: null,
              type: 'queue_delay',
              title: `${svc.name} queue paused`,
              body: `The ${svc.name} queue is temporarily paused. Your spot remains saved.`,
            });
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff, fsServices, fsTickets]
  );

  const sendAnnouncement = useCallback(
    async (serviceId: string | 'all', message: string, expiresAt?: number | null) => {
      if (!canOperateAsStaff) {
        throw new Error('Staff authorization required.');
      }
      const clean = message.trim().slice(0, 240);
      if (!clean) {
        throw new Error('Enter an announcement message before publishing.');
      }
      const validExpiry =
        typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > Date.now()
          ? expiresAt
          : null;

      return runWithActionLock(`ann_${serviceId}`, async () => {
        if (isDemoMode) {
          updateDemoState((prev) => {
            const svcName =
              serviceId === 'all'
                ? 'All Desks'
                : prev.services.find((s) => s.id === serviceId)?.name ?? 'Branch Update';
            const now = Date.now();
            const newAnn: Announcement = {
              id: makeId('ann'),
              serviceId,
              message: clean,
              authorUid: user?.uid ?? 'demo_staff_local',
              createdAt: now,
              expiresAt: validExpiry,
            };
            const nextNotifs = [...prev.notifications];
            const affectedUids = new Set(
              prev.tickets
                .filter(
                  (t) =>
                    (t.status === 'waiting' || t.status === 'called') &&
                    (serviceId === 'all' || t.serviceId === serviceId) &&
                    typeof t.userId === 'string' &&
                    t.userId.length > 0
                )
                .map((t) => t.userId as string)
            );
            for (const uid of affectedUids) {
              nextNotifs.unshift({
                id: makeId('ntf'),
                userId: uid,
                ticketId: null,
                ticketNumber: null,
                type: 'announcement',
                title: `Announcement · ${svcName}`,
                body: clean,
                read: false,
                emailStatus: 'provider_not_configured',
                createdAt: now,
              });
            }
            return {
              ...prev,
              announcements: [newAnn, ...prev.announcements],
              notifications: nextNotifs,
            };
          });
          return;
        }

        if (!user || !isStaff) {
          throw new Error('Staff authorization required.');
        }
        const annId = makeId('ann');
        const svcName =
          serviceId === 'all'
            ? 'All Desks'
            : fsServices.find((s) => s.id === serviceId)?.name ?? 'Branch Update';

        try {
          const batch = writeBatch(db);
          const payload: Record<string, unknown> = {
            id: annId,
            serviceId,
            message: clean,
            authorUid: user.uid,
            createdAt: serverTimestamp(),
          };
          if (validExpiry) {
            payload.expiresAt = Timestamp.fromMillis(validExpiry);
          }
          batch.set(doc(db, 'announcements', annId), payload);

          const affectedUserIds = new Set(
            fsTickets
              .filter(
                (t) =>
                  (t.status === 'waiting' || t.status === 'called') &&
                  (serviceId === 'all' || t.serviceId === serviceId) &&
                  typeof t.userId === 'string' &&
                  t.userId.length > 0
              )
              .map((t) => t.userId as string)
          );
          for (const targetUid of affectedUserIds) {
            queueNotificationInBatch(batch, targetUid, {
              ticketId: null,
              ticketNumber: null,
              type: 'announcement',
              title: `Announcement · ${svcName}`,
              body: clean,
            });
          }

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `announcements/${annId}`);
        }
      });
    },
    [canOperateAsStaff, runWithActionLock, isDemoMode, updateDemoState, user, isStaff, fsServices, fsTickets]
  );

  const clearAnnouncement = useCallback(
    async (announcementId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        updateDemoState((prev) => ({
          ...prev,
          announcements: prev.announcements.filter((a) => a.id !== announcementId),
        }));
        return;
      }

      if (!user || !isStaff) return;
      try {
        await deleteDoc(doc(db, 'announcements', announcementId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `announcements/${announcementId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      if (isDemoMode) {
        updateDemoState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        }));
        return;
      }

      if (!user) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'notifications', notificationId), { read: true });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
      }
    },
    [isDemoMode, updateDemoState, user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (isDemoMode) {
      updateDemoState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.userId === activeDemoVisitorUid ? { ...n, read: true } : n
        ),
      }));
      return;
    }

    if (!user) return;
    const unread = fsNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  }, [isDemoMode, updateDemoState, activeDemoVisitorUid, user, fsNotifications]);

  const createSupportThread = useCallback(
    async (
      serviceId: string | null,
      subject: string,
      messageText: string
    ): Promise<string | null> => {
      const cleanSubject = subject.trim().slice(0, 120);
      const cleanMessage = messageText.trim().slice(0, 1000);
      if (!cleanSubject || !cleanMessage) return null;

      if (isDemoMode) {
        const threadId = makeId('thr');
        const messageId = makeId('msg');
        const senderName = canOperateAsStaff ? 'Staff (Demo)' : 'Demo Visitor';
        const now = Date.now();

        const newThread: SupportThread = {
          id: threadId,
          userId: activeDemoVisitorUid,
          visitorName: senderName,
          serviceId: serviceId || null,
          subject: cleanSubject,
          status: 'open',
          lastMessageText: cleanMessage.slice(0, 500),
          createdAt: now,
          updatedAt: now,
        };
        const firstMsg: SupportMessage = {
          id: messageId,
          threadOwnerUid: activeDemoVisitorUid,
          senderUid: activeDemoVisitorUid,
          senderRole: canOperateAsStaff ? 'staff' : 'visitor',
          senderName,
          text: cleanMessage,
          createdAt: now,
        };

        updateDemoState((prev) => ({
          ...prev,
          supportThreads: [newThread, ...prev.supportThreads],
          supportMessages: {
            ...prev.supportMessages,
            [threadId]: [firstMsg],
          },
        }));
        return threadId;
      }

      if (!user) return null;
      const threadId = makeId('thr');
      const messageId = makeId('msg');
      const senderName = (profile?.name || user.displayName || 'Visitor').slice(0, 80);

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'supportThreads', threadId), {
          id: threadId,
          userId: user.uid,
          visitorName: senderName,
          serviceId: serviceId || null,
          subject: cleanSubject,
          status: 'open',
          lastMessageText: cleanMessage.slice(0, 500),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'supportThreads', threadId, 'messages', messageId), {
          id: messageId,
          threadOwnerUid: user.uid,
          senderUid: user.uid,
          senderRole: isStaff ? 'staff' : 'visitor',
          senderName,
          text: cleanMessage,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        return threadId;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `supportThreads/${threadId}`);
        return null;
      }
    },
    [isDemoMode, profile, user, activeDemoVisitorUid, canOperateAsStaff, updateDemoState, isStaff]
  );

  const sendSupportMessage = useCallback(
    async (threadId: string, text: string) => {
      const clean = text.trim().slice(0, 1000);
      if (!clean) return;

      if (isDemoMode) {
        updateDemoState((prev) => {
          const thread = prev.supportThreads.find((t) => t.id === threadId);
          if (!thread) return prev;
          const now = Date.now();
          const senderRole = canOperateAsStaff ? 'staff' : 'visitor';
          const senderName = senderRole === 'staff' ? 'Staff (Demo)' : 'Demo Visitor';
          const msg: SupportMessage = {
            id: makeId('msg'),
            threadOwnerUid: thread.userId,
            senderUid: senderRole === 'staff' ? 'demo_staff_local' : activeDemoVisitorUid,
            senderRole,
            senderName,
            text: clean,
            createdAt: now,
          };
          const existingMsgs = prev.supportMessages[threadId] ?? [];
          return {
            ...prev,
            supportThreads: prev.supportThreads.map((t) =>
              t.id === threadId
                ? { ...t, lastMessageText: clean.slice(0, 500), updatedAt: now }
                : t
            ),
            supportMessages: {
              ...prev.supportMessages,
              [threadId]: [...existingMsgs, msg],
            },
          };
        });
        return;
      }

      if (!user) return;
      const thread = fsSupportThreads.find((t) => t.id === threadId);
      if (!thread) return;

      const messageId = makeId('msg');
      const senderName = (profile?.name || user.displayName || (isStaff ? 'Staff' : 'Visitor')).slice(
        0,
        80
      );

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'supportThreads', threadId, 'messages', messageId), {
          id: messageId,
          threadOwnerUid: thread.userId,
          senderUid: user.uid,
          senderRole: isStaff ? 'staff' : 'visitor',
          senderName,
          text: clean,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'supportThreads', threadId), {
          lastMessageText: clean.slice(0, 500),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `supportThreads/${threadId}/messages`);
      }
    },
    [
      isDemoMode,
      updateDemoState,
      canOperateAsStaff,
      profile,
      user,
      activeDemoVisitorUid,
      fsSupportThreads,
      isStaff,
    ]
  );

  const resolveSupportThread = useCallback(
    async (threadId: string) => {
      if (!canOperateAsStaff) return;

      if (isDemoMode) {
        const now = Date.now();
        updateDemoState((prev) => ({
          ...prev,
          supportThreads: prev.supportThreads.map((t) =>
            t.id === threadId ? { ...t, status: 'resolved', updatedAt: now } : t
          ),
        }));
        return;
      }

      if (!user || !isStaff) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'supportThreads', threadId), {
          status: 'resolved',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `supportThreads/${threadId}`);
      }
    },
    [canOperateAsStaff, isDemoMode, updateDemoState, user, isStaff]
  );

  const subscribeToThreadMessages = useCallback(
    (threadId: string, onMessages: (msgs: SupportMessage[]) => void) => {
      if (!threadId) return () => {};

      if (isDemoMode) {
        let listeners = demoThreadListenersRef.current.get(threadId);
        if (!listeners) {
          listeners = new Set();
          demoThreadListenersRef.current.set(threadId, listeners);
        }
        listeners.add(onMessages);
        onMessages(demoStateRef.current.supportMessages[threadId] ?? []);
        return () => {
          const currentSet = demoThreadListenersRef.current.get(threadId);
          if (currentSet) {
            currentSet.delete(onMessages);
            if (currentSet.size === 0) {
              demoThreadListenersRef.current.delete(threadId);
            }
          }
        };
      }

      if (!user) return () => {};
      const q = query(
        collection(db, 'supportThreads', threadId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(
        q,
        (snap) => {
          const list: SupportMessage[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              threadOwnerUid: data.threadOwnerUid,
              senderUid: data.senderUid,
              senderRole: data.senderRole,
              senderName: data.senderName,
              text: data.text,
              createdAt: tsToMillis(data.createdAt),
            };
          });
          onMessages(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `supportThreads/${threadId}/messages`);
        }
      );
    },
    [isDemoMode, user]
  );

  const grantStaffAccess = useCallback(
    async (targetUser: UserProfile) => {
      if (!user || !isStaff) return;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'staff', targetUser.uid), {
          uid: targetUser.uid,
          email: targetUser.email,
          name: targetUser.name,
          grantedBy: user.uid,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'users', targetUser.uid), {
          role: 'staff',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `staff/${targetUser.uid}`);
      }
    },
    [user, isStaff]
  );

  const revokeStaffAccess = useCallback(
    async (targetUid: string) => {
      if (!user || !isStaff) return;
      if (targetUid === user.uid) return;
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'staff', targetUid));
        batch.update(doc(db, 'users', targetUid), {
          role: 'visitor',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staff/${targetUid}`);
      }
    },
    [user, isStaff]
  );

  const resetDemoQueue = useCallback(() => {
    const fresh = createInitialDemoQueueState();
    demoStateRef.current = fresh;
    saveDemoQueueState(fresh);
    setDemoState(fresh);
    notifyDemoThreadSubscribers(fresh);
  }, [notifyDemoThreadSubscribers]);

  // Selectors based on zero-PII queueFeed so digital + walk-in positions are always unified
  const getServiceById = useCallback(
    (serviceId: string) => services.find((s) => s.id === serviceId),
    [services]
  );

  const getWaitingFeedForService = useCallback(
    (serviceId: string) =>
      queueFeed
        .filter((f) => f.serviceId === serviceId && f.status === 'waiting')
        .sort((a, b) => a.queueOrderAt - b.queueOrderAt),
    [queueFeed]
  );

  const getServiceEstimatedWait = useCallback(
    (serviceId: string) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return 0;
      const waitingCount = queueFeed.filter(
        (f) => f.serviceId === serviceId && f.status === 'waiting'
      ).length;
      if (waitingCount === 0) return 0;
      return Math.max(
        2,
        Math.round((waitingCount * service.avgServiceMinutes) / Math.max(1, service.counters.length))
      );
    },
    [services, queueFeed]
  );

  const getTicketPosition = useCallback(
    (ticketId: string): TicketPositionInfo | null => {
      const feedItem =
        queueFeed.find((f) => f.id === ticketId) ?? tickets.find((t) => t.id === ticketId);
      if (!feedItem) return null;
      const service = services.find((s) => s.id === feedItem.serviceId);
      if (!service) return null;

      const waiting = queueFeed
        .filter((f) => f.serviceId === feedItem.serviceId && f.status === 'waiting')
        .sort((a, b) => a.queueOrderAt - b.queueOrderAt);

      if (feedItem.status !== 'waiting') {
        return {
          position: 0,
          peopleAhead: 0,
          totalWaiting: waiting.length,
          estimatedWaitMinutes: 0,
        };
      }

      const idx = waiting.findIndex((f) => f.id === ticketId);
      const peopleAhead = idx === -1 ? 0 : idx;
      const position = peopleAhead + 1;
      const estimatedWaitMinutes = Math.max(
        2,
        Math.round(
          ((peopleAhead + 1) * service.avgServiceMinutes) / Math.max(1, service.counters.length)
        )
      );

      return {
        position,
        peopleAhead,
        totalWaiting: waiting.length,
        estimatedWaitMinutes,
      };
    },
    [services, queueFeed, tickets]
  );

  const upsertBranchChatThread = useCallback(
    (input: UpsertBranchChatThreadInput): BranchChatThreadMeta => {
      const id = `${input.channelId}::${input.branchKey}`;
      const now = input.lastMessageAt ?? Date.now();
      let result: BranchChatThreadMeta | null = null;

      updateDemoState((prev) => {
        const current = prev.branchChatThreads || [];
        const existing = current.find(
          (t) =>
            t.id === id ||
            (t.channelId === input.channelId && t.branchKey === input.branchKey)
        );
        const nextThread: BranchChatThreadMeta = {
          id,
          channelId: input.channelId,
          visitorUid: input.visitorUid || existing?.visitorUid || input.channelId,
          visitorName: input.visitorName || existing?.visitorName || 'Visitor',
          branchKey: input.branchKey,
          locationName: input.locationName || existing?.locationName || 'Bank Branch',
          serviceId:
            input.serviceId !== undefined ? input.serviceId : existing?.serviceId ?? null,
          serviceName:
            input.serviceName !== undefined ? input.serviceName : existing?.serviceName ?? null,
          ticketId:
            input.ticketId !== undefined ? input.ticketId : existing?.ticketId ?? null,
          ticketNumber:
            input.ticketNumber !== undefined
              ? input.ticketNumber
              : existing?.ticketNumber ?? null,
          reason: input.reason !== undefined ? input.reason : existing?.reason ?? null,
          unreadForStaff: Math.max(
            0,
            (existing?.unreadForStaff ?? 0) + (input.unreadForStaffIncrement ?? 0)
          ),
          lastMessageText:
            input.lastMessageText !== undefined
              ? input.lastMessageText
              : existing?.lastMessageText ?? '',
          lastMessageAt: now,
        };
        result = nextThread;
        const filtered = current.filter(
          (t) =>
            t.id !== id &&
            !(t.channelId === input.channelId && t.branchKey === input.branchKey)
        );
        return {
          ...prev,
          branchChatThreads: [nextThread, ...filtered],
        };
      });

      return (
        result ?? {
          id,
          channelId: input.channelId,
          visitorUid: input.visitorUid,
          visitorName: input.visitorName,
          branchKey: input.branchKey,
          locationName: input.locationName,
          serviceId: input.serviceId ?? null,
          serviceName: input.serviceName ?? null,
          ticketId: input.ticketId ?? null,
          ticketNumber: input.ticketNumber ?? null,
          reason: input.reason ?? null,
          unreadForStaff: input.unreadForStaffIncrement ?? 0,
          lastMessageText: input.lastMessageText ?? '',
          lastMessageAt: now,
        }
      );
    },
    [updateDemoState]
  );

  const markBranchChatThreadRead = useCallback(
    (threadId: string) => {
      updateDemoState((prev) => ({
        ...prev,
        branchChatThreads: (prev.branchChatThreads || []).map((t) =>
          t.id === threadId && t.unreadForStaff !== 0 ? { ...t, unreadForStaff: 0 } : t
        ),
      }));
    },
    [updateDemoState]
  );

  const sendBranchChatMessage = useCallback(
    (params: {
      channelId: string;
      threadOwnerUid: string;
      senderUid: string;
      senderRole: UserRole;
      senderName: string;
      text: string;
    }): SupportMessage | null => {
      const clean = params.text.trim().slice(0, 1000);
      if (!clean) return null;
      const now = Date.now();
      const msg: SupportMessage = {
        id: makeId('bmsg'),
        threadOwnerUid: params.threadOwnerUid,
        senderUid: params.senderUid,
        senderRole: params.senderRole,
        senderName: params.senderName.slice(0, 80),
        text: clean,
        createdAt: now,
      };
      updateDemoState((prev) => {
        const list = prev.supportMessages[params.channelId] ?? [];
        return {
          ...prev,
          supportMessages: {
            ...prev.supportMessages,
            [params.channelId]: [...list, msg],
          },
        };
      });
      return msg;
    },
    [updateDemoState]
  );

  const getBranchChatMessages = useCallback(
    (channelId: string): SupportMessage[] => {
      return demoState.supportMessages[channelId] ?? [];
    },
    [demoState.supportMessages]
  );

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <QueueContext.Provider
      value={{
        services,
        queueFeed,
        tickets,
        announcements,
        rawAnnouncements,
        notifications,
        supportThreads,
        branchChatThreads,
        allUsers,
        staffMembers,
        loadingQueue: isDemoMode ? false : loadingServices,
        isDemoMode,
        unreadNotificationCount,
        joinQueue,
        joinAnonymousQrQueue,
        leaveAnonymousQrTicket,
        leaveQueue,
        markNotificationRead,
        markAllNotificationsRead,
        createSupportThread,
        sendSupportMessage,
        resolveSupportThread,
        subscribeToThreadMessages,
        upsertBranchChatThread,
        markBranchChatThreadRead,
        sendBranchChatMessage,
        getBranchChatMessages,
        seedInitialData,
        createService,
        updateService,
        addWalkIn,
        addTestDigitalTicket,
        callNext,
        callSpecificTicket,
        recallTicket,
        assignTicketCounter,
        notifyTicketVisitor,
        markServing,
        completeTicket,
        deferTicket,
        requeueTicket,
        toggleServicePause,
        sendAnnouncement,
        clearAnnouncement,
        grantStaffAccess,
        revokeStaffAccess,
        resetDemoQueue,
        getServiceById,
        getTicketPosition,
        getServiceEstimatedWait,
        getWaitingFeedForService,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueProvider');
  return ctx;
}
