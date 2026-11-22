import { DEMO_BRANCH_ID, DEMO_DESK_ID } from '../data/bankCatalog';
import { DEFAULT_SERVICES, STARTER_WALKIN_TICKETS } from '../data/seedData';
import {
  Announcement,
  BranchChatThreadMeta,
  NotificationItem,
  ServiceLocation,
  SupportMessage,
  SupportThread,
  Ticket,
} from '../types/queue';

export const DEMO_QUEUE_STORAGE_KEY = 'lineless_demo_queue_v1';

export interface DemoQueueState {
  services: ServiceLocation[];
  tickets: Ticket[];
  announcements: Announcement[];
  notifications: NotificationItem[];
  supportThreads: SupportThread[];
  supportMessages: Record<string, SupportMessage[]>;
  branchChatThreads: BranchChatThreadMeta[];
}

export function createInitialDemoQueueState(): DemoQueueState {
  const baseTime = Date.now() - 12 * 60 * 1000;
  const services: ServiceLocation[] = DEFAULT_SERVICES.map((svc) => ({
    id: svc.id,
    name: svc.name,
    facility: svc.facility,
    locationDetail: svc.locationDetail,
    prefix: svc.prefix,
    avgServiceMinutes: svc.avgServiceMinutes,
    counters: [...svc.counters],
    isPaused: false,
    nextSequence: svc.nextSequence,
    updatedAt: baseTime,
  }));

  const tickets: Ticket[] = STARTER_WALKIN_TICKETS.map((t, idx) => {
    const tTime = baseTime + idx * 40 * 1000;
    const isCalled = t.status === 'called' || t.status === 'serving' || t.status === 'completed';
    const isCompleted = t.status === 'completed';
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      serviceId: t.serviceId,
      visitorName: t.visitorName,
      userId: t.channel === 'digital' ? `demo_visitor_seed_${t.id}` : null,
      channel: t.channel,
      status: t.status,
      counter: t.counter,
      reason: t.reason,
      createdAt: tTime,
      queueOrderAt: tTime,
      updatedAt: tTime,
      calledAt: isCalled ? tTime + 30000 : null,
      completedAt: isCompleted ? tTime + 120000 : null,
    };
  });

  // Pre-seed realistic Lalbagh Desk Inbox threads matching the homepage & staff inbox showcase
  const seedThreads: BranchChatThreadMeta[] = [
    {
      id: `pre_inquiry_lalbagh::${DEMO_BRANCH_ID}`,
      channelId: 'ln_seed_inquiry_rhea',
      visitorUid: 'ln_seed_inquiry_rhea',
      visitorName: 'Rhea Rao',
      branchKey: DEMO_BRANCH_ID,
      locationName: 'Karnataka Bank — Lalbagh Road Branch',
      serviceId: DEMO_DESK_ID,
      serviceName: 'Customer Service',
      ticketId: null,
      ticketNumber: null,
      reason: 'New savings account inquiry',
      unreadForStaff: 1,
      lastMessageText: 'Hi, do I need two photographs along with Aadhaar and PAN?',
      lastMessageAt: Date.now() - 90 * 1000,
    },
    {
      id: `t-b-106::${DEMO_BRANCH_ID}`,
      channelId: 'ln_seed_b106',
      visitorUid: 'demo_visitor_seed_t-b-106',
      visitorName: 'Karthik Gowda',
      branchKey: DEMO_BRANCH_ID,
      locationName: 'Karnataka Bank — Lalbagh Road Branch',
      serviceId: DEMO_DESK_ID,
      serviceName: 'Customer Service',
      ticketId: 't-b-106',
      ticketNumber: 'B-106',
      reason: 'Passbook update',
      unreadForStaff: 0,
      lastMessageText: 'Checked in for passbook printing at Counter 2.',
      lastMessageAt: Date.now() - 3 * 60 * 1000,
    },
  ];

  const seedSupportMessages: Record<string, SupportMessage[]> = {
    'ln_seed_inquiry_rhea': [
      {
        id: 'seed_msg_1',
        threadOwnerUid: 'ln_seed_inquiry_rhea',
        senderUid: 'ln_seed_inquiry_rhea',
        senderRole: 'visitor',
        senderName: 'Rhea Rao',
        text: 'Hi, do I need two photographs along with Aadhaar and PAN?',
        createdAt: Date.now() - 90 * 1000,
      },
    ],
    'ln_seed_b106': [
      {
        id: 'seed_msg_2',
        threadOwnerUid: 'demo_visitor_seed_t-b-106',
        senderUid: 'demo_visitor_seed_t-b-106',
        senderRole: 'visitor',
        senderName: 'Karthik Gowda',
        text: 'Checked in for passbook printing at Counter 2.',
        createdAt: Date.now() - 3 * 60 * 1000,
      },
    ],
  };

  return {
    services,
    tickets,
    announcements: [],
    notifications: [],
    supportThreads: [],
    supportMessages: seedSupportMessages,
    branchChatThreads: seedThreads,
  };
}

function isLegacyNonBankState(services: ServiceLocation[]): boolean {
  return services.some(
    (s) =>
      s.id === 'general-clinic' ||
      s.id === 'civic-passport' ||
      s.id === 'diagnostics-lab' ||
      s.id === 'pharmacy-pickup' ||
      s.id === 'ent-museum-entry-desk'
  );
}

export function loadDemoQueueState(): DemoQueueState {
  try {
    const raw = localStorage.getItem(DEMO_QUEUE_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialDemoQueueState();
      saveDemoQueueState(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<DemoQueueState>;
    if (
      !Array.isArray(parsed.services) ||
      !Array.isArray(parsed.tickets) ||
      isLegacyNonBankState(parsed.services)
    ) {
      const fresh = createInitialDemoQueueState();
      saveDemoQueueState(fresh);
      return fresh;
    }
    return {
      services: parsed.services,
      tickets: parsed.tickets,
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      supportThreads: Array.isArray(parsed.supportThreads) ? parsed.supportThreads : [],
      supportMessages:
        parsed.supportMessages && typeof parsed.supportMessages === 'object'
          ? parsed.supportMessages
          : {},
      branchChatThreads: Array.isArray(parsed.branchChatThreads)
        ? parsed.branchChatThreads
        : [],
    };
  } catch {
    return createInitialDemoQueueState();
  }
}

export function saveDemoQueueState(state: DemoQueueState): void {
  try {
    localStorage.setItem(DEMO_QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
