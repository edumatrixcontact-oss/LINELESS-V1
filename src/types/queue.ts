export type ViewMode =
  | 'home'
  | 'visitor'
  | 'visitor-login'
  | 'staff'
  | 'staff-login'
  | 'display'
  | 'qr'
  | 'auth';
export type ThemeMode = 'light' | 'dark';

export type UserRole = 'visitor' | 'staff';

export type TicketChannel = 'digital' | 'walk-in';
export type TicketStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'deferred'
  | 'cancelled';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  emailNotificationsEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StaffMember {
  uid: string;
  email: string;
  name: string;
  grantedBy: string;
  createdAt: number;
}

export interface ServiceLocation {
  id: string;
  name: string;
  facility: string;
  locationDetail: string;
  prefix: string;
  avgServiceMinutes: number;
  counters: string[];
  isPaused: boolean;
  nextSequence: number;
  updatedAt: number;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  serviceId: string;
  visitorName: string;
  userId: string | null;
  channel: TicketChannel;
  status: TicketStatus;
  counter: string | null;
  reason?: string;
  sessionType?: 'authenticated' | 'demo';
  createdAt: number;
  queueOrderAt: number;
  updatedAt: number;
  calledAt: number | null;
  completedAt: number | null;
}

export interface QueueFeedItem {
  id: string;
  ticketNumber: string;
  serviceId: string;
  status: TicketStatus;
  counter: string | null;
  createdAt: number;
  queueOrderAt: number;
  updatedAt: number;
  calledAt: number | null;
  completedAt: number | null;
}

export interface Announcement {
  id: string;
  serviceId: string | 'all';
  message: string;
  authorUid: string;
  createdAt: number;
  expiresAt?: number | null;
}

export type NotificationType =
  | 'ticket_joined'
  | 'ticket_called'
  | 'counter_assigned'
  | 'ticket_deferred'
  | 'ticket_completed'
  | 'queue_delay'
  | 'announcement';

export interface NotificationItem {
  id: string;
  userId: string;
  ticketId: string | null;
  ticketNumber: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  emailStatus: 'provider_not_configured' | 'disabled';
  createdAt: number;
}

export interface SupportThread {
  id: string;
  userId: string;
  visitorName: string;
  serviceId: string | null;
  subject: string;
  status: 'open' | 'resolved';
  lastMessageText: string;
  createdAt: number;
  updatedAt: number;
}

export interface SupportMessage {
  id: string;
  threadOwnerUid: string;
  senderUid: string;
  senderRole: UserRole;
  senderName: string;
  text: string;
  createdAt: number;
}

export interface BranchChatThreadMeta {
  id: string;
  channelId: string;
  visitorUid: string;
  visitorName: string;
  branchKey: string;
  locationName: string;
  serviceId: string | null;
  serviceName: string | null;
  ticketId: string | null;
  ticketNumber: string | null;
  reason: string | null;
  unreadForStaff: number;
  lastMessageText: string;
  lastMessageAt: number;
}

export interface TicketPositionInfo {
  position: number;
  peopleAhead: number;
  totalWaiting: number;
  estimatedWaitMinutes: number;
}
