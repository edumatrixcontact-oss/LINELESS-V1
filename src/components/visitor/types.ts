export type VisitorNavTab = 'conversations' | 'tickets' | 'profile';

export type ConversationMode = 'queue-ai' | 'desk-chat';

export type VisitorThemeMode = 'light' | 'dark';

export interface VisitorChatContext {
  branchKey: string;
  locationName: string;
  serviceName?: string;
  queueServiceId?: string;
  categoryId?: string;
  ticketId?: string;
  ticketNumber?: string;
}

export interface DeskSystemEvent {
  id: string;
  branchKey: string;
  ticketId?: string;
  ticketNumber?: string;
  text: string;
  timestamp: number;
}

export interface BranchConversationMeta {
  branchKey: string;
  locationName: string;
  categoryId?: string;
  serviceId?: string;
  serviceName?: string;
  ticketId?: string;
  ticketNumber?: string;
  firstTaggedSent: boolean;
  updatedAt: number;
}

export interface QueueAIBookingForm {
  open: boolean;
  visitorName: string;
  branchKey: string;
  serviceId: string;
  reason: string;
  isSubmitting: boolean;
  error: string;
}

export interface QueueAISuggestionItem {
  label: string;
  branchKey?: string;
  serviceId?: string;
  action: 'ask-query' | 'select-branch' | 'select-desk' | 'ask-desk-chat' | 'review-booking';
  queryText?: string;
}

export interface QueueAIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  announcements?: Array<{ id: string; scopeLabel: string; message: string }>;
  suggestions?: QueueAISuggestionItem[];
  askBranch?: {
    branchKey: string;
    locationName: string;
    serviceName?: string;
    queueServiceId?: string;
    categoryId?: string;
  };
  reviewBookingTrigger?: {
    branchKey: string;
    locationName: string;
    serviceId: string;
    serviceName: string;
    reason?: string;
  };
  confirmedTicket?: {
    ticketId: string;
    ticketNumber: string;
    branchKey: string;
    locationName: string;
    serviceId: string;
    serviceName: string;
    categoryId?: string;
    isBankDesk: boolean;
  };
}
