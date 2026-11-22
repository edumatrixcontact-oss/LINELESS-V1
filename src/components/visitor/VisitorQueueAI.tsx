import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Clock,
  Megaphone,
  MessageSquare,
  PauseCircle,
  Sparkles,
  Ticket as TicketIcon,
} from 'lucide-react';
import { Ticket, TicketPositionInfo } from '../../types/queue';
import { VisitorBranchItem, VisitorDeskItem } from './branchCatalog';
import {
  QueueAIBookingForm,
  QueueAIMessage,
  QueueAISuggestionItem,
  VisitorThemeMode,
} from './types';

export interface QueueAIPendingIntent {
  branchKey: string;
  serviceId: string;
  reason?: string;
}

interface VisitorQueueAIProps {
  visitorTheme: VisitorThemeMode;
  branches: VisitorBranchItem[];
  messages: QueueAIMessage[];
  onSetMessages: React.Dispatch<React.SetStateAction<QueueAIMessage[]>>;
  draft: string;
  onSetDraft: (val: string) => void;
  pendingIntent: QueueAIPendingIntent | null;
  onSetPendingIntent: (intent: QueueAIPendingIntent | null) => void;
  bookingForm: QueueAIBookingForm;
  onSetBookingForm: React.Dispatch<React.SetStateAction<QueueAIBookingForm>>;
  tickets: Ticket[];
  getTicketPosition: (ticketId: string) => TicketPositionInfo | null;
  onConfirmBooking: (params: {
    visitorName: string;
    branchKey: string;
    serviceId: string;
    reason: string;
  }) => Promise<Ticket>;
  onOpenDeskChatForBranch: (params: {
    branchKey: string;
    locationName: string;
    serviceId?: string;
    serviceName?: string;
    categoryId?: string;
    ticketId?: string;
    ticketNumber?: string;
  }) => void;
}

const STOP_WORDS = new Set([
  'the',
  'at',
  'in',
  'on',
  'for',
  'to',
  'a',
  'an',
  'is',
  'are',
  'how',
  'long',
  'what',
  'when',
  'where',
  'can',
  'i',
  'we',
  'my',
  'me',
  'about',
  'please',
  'check',
  'find',
  'open',
  'desk',
  'desks',
  'queue',
  'queues',
  'wait',
  'time',
  'branch',
  'location',
  'locations',
  'service',
  'services',
  'ticket',
  'book',
  'join',
  'get',
  'want',
  'need',
  'do',
  'you',
  'there',
  'any',
  'today',
  'now',
  'hours',
  'with',
]);

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function findMatchingBranches(query: string, branches: VisitorBranchItem[]): VisitorBranchItem[] {
  const q = query.toLowerCase();
  const tokens = extractTokens(query);

  const scored = branches
    .map((branch) => {
      const hay = `${branch.locationName} ${branch.area} ${branch.address} ${branch.categoryName} ${branch.desks
        .map((d) => `${d.name} ${d.description}`)
        .join(' ')}`.toLowerCase();

      let score = 0;
      if (q.includes(branch.locationName.toLowerCase())) score += 10;
      if (branch.area && q.includes(branch.area.toLowerCase())) score += 5;
      for (const d of branch.desks) {
        if (q.includes(d.name.toLowerCase())) score += 8;
      }
      for (const t of tokens) {
        if (branch.locationName.toLowerCase().includes(t)) score += 3;
        else if (branch.area.toLowerCase().includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
      }
      return { branch, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.branch);
}

function findMatchingDesk(
  query: string,
  branch: VisitorBranchItem
): VisitorDeskItem | null {
  const q = query.toLowerCase();
  const tokens = extractTokens(query);
  let best: { desk: VisitorDeskItem; score: number } | null = null;

  for (const desk of branch.desks) {
    let score = 0;
    if (q.includes(desk.name.toLowerCase())) score += 10;
    const hay = `${desk.name} ${desk.description}`.toLowerCase();
    for (const t of tokens) {
      if (desk.name.toLowerCase().includes(t)) score += 4;
      else if (hay.includes(t)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { desk, score };
    }
  }
  return best?.desk ?? null;
}

function isAffirmative(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[!.,?]/g, '');
  return (
    /^(yes|yeah|yep|yup|sure|ok|okay|confirm|proceed|go ahead|book it|join|do it|sounds good|yes please|please do)$/.test(
      normalized
    ) || /\b(yes|confirm|go ahead|book it|prepare booking|review booking)\b/.test(normalized)
  );
}

function isDocumentChecklistQuestion(text: string): boolean {
  return /\b(document|documents|id proof|paperwork|aadhaar|pan|bring|required|requirement|kyc|open account|new account|loan|passbook|forex)\b/i.test(
    text
  );
}

function isUnavailablePolicyQuestion(text: string): boolean {
  return /\b(lunch|break|holiday|holidays|closed|fee|fees|charge|locker|parking|wheelchair|dress)\b/i.test(
    text
  );
}

function isBookingVerb(text: string): boolean {
  return /\b(book|join|take a ticket|get a ticket|get ticket|reserve|spot|line up|queue up)\b/i.test(
    text
  );
}

function formatAnnouncementsList(branch: VisitorBranchItem) {
  return branch.announcements.map((a) => ({
    id: a.id,
    scopeLabel: a.serviceId === 'all' ? 'All locations' : branch.locationName,
    message: a.message,
  }));
}

export function VisitorQueueAI({
  visitorTheme,
  branches,
  messages,
  onSetMessages,
  draft,
  onSetDraft,
  pendingIntent,
  onSetPendingIntent,
  bookingForm,
  onSetBookingForm,
  tickets,
  getTicketPosition,
  onConfirmBooking,
  onOpenDeskChatForBranch,
}: VisitorQueueAIProps) {
  const isDark = visitorTheme === 'dark';
  const [lastFocusedBranchKey, setLastFocusedBranchKey] = useState<string | null>(null);
  const bookingLockRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, bookingForm.open]);

  const branchByKey = useMemo(
    () => new Map(branches.map((b) => [b.branchKey, b])),
    [branches]
  );

  const selectedFormBranch = useMemo(
    () => branchByKey.get(bookingForm.branchKey) ?? branches[0] ?? null,
    [branchByKey, branches, bookingForm.branchKey]
  );

  const ticketById = useMemo(
    () => new Map(tickets.map((t) => [t.id, t])),
    [tickets]
  );

  const pushAssistantMessage = (msg: Omit<QueueAIMessage, 'id' | 'role' | 'timestamp'>) => {
    onSetMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        timestamp: Date.now(),
      },
    ]);
  };

  const describeBranchResponse = (
    branch: VisitorBranchItem,
    opts?: { specificDesk?: VisitorDeskItem | null; userAskedBooking?: boolean; reasonText?: string }
  ) => {
    setLastFocusedBranchKey(branch.branchKey);
    const branchAnnouncements = formatAnnouncementsList(branch);

    // Specific desk chosen OR single-desk branch
    const targetDesk =
      opts?.specificDesk || (branch.desks.length === 1 ? branch.desks[0] : null);

    if (targetDesk) {
      const statusText = targetDesk.isPaused
        ? 'currently paused'
        : targetDesk.isLive
        ? `open (${targetDesk.waitDisplay.toLowerCase()}, ${targetDesk.waitingCount} waiting)`
        : targetDesk.canBook
        ? 'available in demo mode (wait estimate unavailable until first check-in)'
        : 'not accepting live online joins right now (wait estimate unavailable)';

      const hoursText = branch.hours ? ` Hours: ${branch.hours}.` : '';

      if (targetDesk.isPaused) {
        onSetPendingIntent(null);
        pushAssistantMessage({
          text: `${targetDesk.name} at ${branch.locationName} is currently paused and not accepting new queue bookings.${hoursText} You can message the branch directly to check when it will reopen.`,
          announcements: branchAnnouncements,
          askBranch: {
            branchKey: branch.branchKey,
            locationName: branch.locationName,
            serviceName: targetDesk.name,
            queueServiceId: targetDesk.serviceId,
            categoryId: branch.categoryId,
          },
        });
        return;
      }

      if (!targetDesk.canBook) {
        onSetPendingIntent(null);
        pushAssistantMessage({
          text: `${targetDesk.name} at ${branch.locationName} is ${statusText}.${hoursText}`,
          announcements: branchAnnouncements,
          askBranch: {
            branchKey: branch.branchKey,
            locationName: branch.locationName,
            serviceName: targetDesk.name,
            queueServiceId: targetDesk.serviceId,
            categoryId: branch.categoryId,
          },
        });
        return;
      }

      // Ready to ask for confirmation in natural language
      onSetPendingIntent({
        branchKey: branch.branchKey,
        serviceId: targetDesk.serviceId,
        reason: opts?.reasonText,
      });

      const confirmLine = opts?.userAskedBooking
        ? `Ready to book a queue ticket for ${targetDesk.name} at ${branch.locationName}? (${targetDesk.waitDisplay})`
        : `${targetDesk.name} at ${branch.locationName} is ${statusText}.${hoursText} Would you like to book a queue ticket here?`;

      pushAssistantMessage({
        text: confirmLine,
        announcements: branchAnnouncements,
        suggestions: [
          {
            label: 'Yes, prepare booking',
            action: 'review-booking',
            branchKey: branch.branchKey,
            serviceId: targetDesk.serviceId,
          },
        ],
        askBranch: {
          branchKey: branch.branchKey,
          locationName: branch.locationName,
          serviceName: targetDesk.name,
          queueServiceId: targetDesk.serviceId,
          categoryId: branch.categoryId,
        },
      });
      return;
    }

    // Multiple desks at this branch — let visitor choose which desk
    onSetPendingIntent(null);
    const deskSummaryLines = branch.desks
      .map((d) => `• ${d.name} — ${d.waitDisplay}${d.isPaused ? '' : d.isLive ? ` (${d.waitingCount} waiting)` : ''}`)
      .join('\n');

    pushAssistantMessage({
      text: `${branch.locationName}${branch.hours ? ` (Hours: ${branch.hours})` : ''} has ${branch.desks.length} desks:\n${deskSummaryLines}\nWhich desk would you like to check or join?`,
      announcements: branchAnnouncements,
      suggestions: branch.desks.map((d) => ({
        label: d.name,
        action: 'select-desk',
        branchKey: branch.branchKey,
        serviceId: d.serviceId,
      })),
      askBranch: {
        branchKey: branch.branchKey,
        locationName: branch.locationName,
        categoryId: branch.categoryId,
      },
    });
  };

  const openInlineBookingForm = (branchKey: string, serviceId: string, reason = '') => {
    const branch = branchByKey.get(branchKey);
    const desk = branch?.desks.find((d) => d.serviceId === serviceId);
    onSetBookingForm((prev) => ({
      ...prev,
      open: true,
      branchKey: branch?.branchKey || prev.branchKey,
      serviceId: desk?.serviceId || prev.serviceId,
      reason: reason || prev.reason,
      error: '',
    }));
  };

  const handleUserMessage = (rawInput: string) => {
    const text = rawInput.trim();
    if (!text) return;

    onSetMessages((prev) => [
      ...prev,
      {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        text,
        timestamp: Date.now(),
      },
    ]);

    const lower = text.toLowerCase();

    // 1. Check if user is confirming a pending booking prompt
    if (
      pendingIntent &&
      isAffirmative(text) &&
      !isUnavailablePolicyQuestion(text) &&
      !isDocumentChecklistQuestion(text)
    ) {
      const branch = branchByKey.get(pendingIntent.branchKey);
      const desk = branch?.desks.find((d) => d.serviceId === pendingIntent.serviceId);
      if (branch && desk) {
        onSetPendingIntent(null);
        pushAssistantMessage({
          text: `Great — tap below to review and confirm your details for ${desk.name} at ${branch.locationName}.`,
          reviewBookingTrigger: {
            branchKey: branch.branchKey,
            locationName: branch.locationName,
            serviceId: desk.serviceId,
            serviceName: desk.name,
            reason: pendingIntent.reason,
          },
        });
        return;
      }
    }

    const matchedBranches = findMatchingBranches(text, branches);
    const activeBranch =
      matchedBranches[0] ||
      (lastFocusedBranchKey ? branchByKey.get(lastFocusedBranchKey) ?? null : null);

    // 2. Document checklist queries for a branch/desk
    if (isDocumentChecklistQuestion(text)) {
      if (activeBranch) {
        setLastFocusedBranchKey(activeBranch.branchKey);
        const matchedDesk = findMatchingDesk(text, activeBranch) || activeBranch.desks[0];
        const checklistLines = activeBranch.desks
          .filter((d) => d.documentChecklist)
          .map((d) => `• ${d.name}: ${d.documentChecklist}`)
          .join('\n');

        const replyText = matchedDesk?.documentChecklist
          ? `For ${matchedDesk.name} at ${activeBranch.locationName}: ${matchedDesk.documentChecklist}${
              activeBranch.desks.length > 1
                ? `\n\nOther desks at this branch:\n${checklistLines}`
                : ''
            }`
          : checklistLines
          ? `Document guidelines for ${activeBranch.locationName}:\n${checklistLines}`
          : `You can message ${activeBranch.locationName} directly to confirm which documents to carry before joining the queue.`;

        pushAssistantMessage({
          text: replyText,
          announcements: formatAnnouncementsList(activeBranch),
          suggestions: matchedDesk?.canBook
            ? [
                {
                  label: `Join ${matchedDesk.name}`,
                  action: 'review-booking',
                  branchKey: activeBranch.branchKey,
                  serviceId: matchedDesk.serviceId,
                },
              ]
            : undefined,
          askBranch: {
            branchKey: activeBranch.branchKey,
            locationName: activeBranch.locationName,
            serviceName: matchedDesk?.name,
            queueServiceId: matchedDesk?.serviceId,
            categoryId: activeBranch.categoryId,
          },
        });
      } else {
        pushAssistantMessage({
          text: "I can share required documents once you pick a bank branch. Which branch are you planning to visit today?",
          suggestions: branches
            .filter((b) => b.desks.some((d) => d.isLive || d.canBook))
            .slice(0, 4)
            .map((b) => ({
              label: b.locationName,
              action: 'select-branch' as const,
              branchKey: b.branchKey,
            })),
        });
      }
      return;
    }

    // 3. Branch-specific policies not stored in LINELESS (lunch breaks, holidays, fees, lockers)
    if (isUnavailablePolicyQuestion(text)) {
      if (activeBranch) {
        setLastFocusedBranchKey(activeBranch.branchKey);
        pushAssistantMessage({
          text: `I don't have live details on lunch break timings, bank holidays, fees, or locker availability for ${activeBranch.locationName}.${
            activeBranch.hours ? ` Listed branch hours are ${activeBranch.hours}.` : ''
          } You can ask the branch desk directly before booking.`,
          announcements: formatAnnouncementsList(activeBranch),
          askBranch: {
            branchKey: activeBranch.branchKey,
            locationName: activeBranch.locationName,
            categoryId: activeBranch.categoryId,
          },
        });
      } else {
        pushAssistantMessage({
          text: "I don't have lunch break times, fee schedules, or holiday closures in LINELESS. Tell me which bank branch you're visiting and I can connect you directly with their desk.",
          suggestions: branches
            .filter((b) => b.desks.some((d) => d.isLive || d.canBook))
            .slice(0, 4)
            .map((b) => ({
              label: b.locationName,
              action: 'select-branch' as const,
              branchKey: b.branchKey,
            })),
        });
      }
      return;
    }

    // 4. Branch matched directly
    if (matchedBranches.length > 0) {
      const topBranch = matchedBranches[0];
      const matchedDesk = findMatchingDesk(text, topBranch);
      if (matchedBranches.length > 1 && matchedBranches.slice(0, 3).every((b) => b.desks.some((d) => d.isLive))) {
        const isBroadCategoryWord = /\b(bank|banks|branch|branches|banking)\b/i.test(text) && !matchedDesk;
        if (isBroadCategoryWord && !text.toLowerCase().includes(topBranch.area.toLowerCase())) {
          const topList = matchedBranches.slice(0, 4);
          const listText = topList
            .map((b) => {
              const openDesks = b.desks.filter((d) => !d.isPaused && (d.isLive || d.canBook));
              const sampleWait = openDesks[0]?.waitDisplay || 'Wait estimate unavailable';
              return `• ${b.locationName} (${b.desks.length} desks · ${sampleWait})`;
            })
            .join('\n');
          pushAssistantMessage({
            text: `Here are matching bank branches:\n${listText}\nWhich branch would you like to check?`,
            suggestions: topList.map((b) => ({
              label: b.locationName,
              action: 'select-branch',
              branchKey: b.branchKey,
            })),
          });
          return;
        }
      }

      describeBranchResponse(topBranch, {
        specificDesk: matchedDesk,
        userAskedBooking: isBookingVerb(text),
      });
      return;
    }

    // 4. Desk matched on previously focused branch
    if (activeBranch) {
      const deskOnActive = findMatchingDesk(text, activeBranch);
      if (deskOnActive) {
        describeBranchResponse(activeBranch, {
          specificDesk: deskOnActive,
          userAskedBooking: isBookingVerb(text),
        });
        return;
      }
      if (isBookingVerb(text)) {
        describeBranchResponse(activeBranch, { userAskedBooking: true });
        return;
      }
    }

    // 5. General queries: "Find an open desk" / "Check a wait time" / "announcements"
    if (/\b(open|available|desk|desks|list|where|locations|branches)\b/.test(lower)) {
      const liveOpen = branches.filter((b) =>
        b.desks.some((d) => d.isLive && !d.isPaused)
      );
      const listToShow = liveOpen.length > 0 ? liveOpen : branches.slice(0, 5);
      const summary = listToShow
        .map((b) => {
          const d = b.desks.find((x) => x.isLive) || b.desks[0];
          return `• ${b.locationName} — ${d.name} (${d.waitDisplay})`;
        })
        .join('\n');

      pushAssistantMessage({
        text: `Here are the locations currently available:\n${summary}\nSelect any location to see its desks, announcements, or join the line.`,
        suggestions: listToShow.slice(0, 5).map((b) => ({
          label: b.locationName,
          action: 'select-branch',
          branchKey: b.branchKey,
        })),
      });
      return;
    }

    if (/\b(wait|time|long|busy|queue|status)\b/.test(lower)) {
      const liveBranches = branches.filter((b) => b.desks.some((d) => d.isLive));
      if (liveBranches.length === 0) {
        pushAssistantMessage({
          text: 'Live queue wait estimates are currently unavailable until a desk opens. Which branch would you like to visit?',
          suggestions: branches.slice(0, 4).map((b) => ({
            label: b.locationName,
            action: 'select-branch',
            branchKey: b.branchKey,
          })),
        });
        return;
      }

      const lines = liveBranches
        .map((b) =>
          b.desks
            .filter((d) => d.isLive)
            .map(
              (d) =>
                `• ${b.locationName} (${d.name}): ${d.waitDisplay}${
                  d.isPaused ? '' : ` · ${d.waitingCount} waiting`
                }`
            )
            .join('\n')
        )
        .join('\n');

      pushAssistantMessage({
        text: `Current live wait estimates:\n${lines}\nChoose a location to see full details or book a ticket.`,
        suggestions: liveBranches.slice(0, 5).map((b) => ({
          label: b.locationName,
          action: 'select-branch',
          branchKey: b.branchKey,
        })),
      });
      return;
    }

    // 6. Fallback honest prompt
    const starterSuggestions = branches
      .filter((b) => b.desks.some((d) => d.isLive || d.canBook))
      .slice(0, 4)
      .map((b) => ({
        label: b.locationName,
        action: 'select-branch' as const,
        branchKey: b.branchKey,
      }));

    pushAssistantMessage({
      text: "I couldn't find that exact bank branch in LINELESS. Pick one of our participating branches below or search by branch name or desk (for example: Karnataka Bank Lalbagh, Canara Bank Indiranagar, or HDFC MG Road).",
      suggestions: starterSuggestions,
    });
  };

  const handleSuggestionClick = (item: QueueAISuggestionItem) => {
    if (item.action === 'ask-query' && item.queryText) {
      handleUserMessage(item.queryText);
      return;
    }
    if (item.action === 'select-branch' && item.branchKey) {
      const branch = branchByKey.get(item.branchKey);
      if (branch) {
        onSetMessages((prev) => [
          ...prev,
          {
            id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'user',
            text: branch.locationName,
            timestamp: Date.now(),
          },
        ]);
        describeBranchResponse(branch);
      }
      return;
    }
    if (item.action === 'select-desk' && item.branchKey && item.serviceId) {
      const branch = branchByKey.get(item.branchKey);
      const desk = branch?.desks.find((d) => d.serviceId === item.serviceId);
      if (branch && desk) {
        onSetMessages((prev) => [
          ...prev,
          {
            id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'user',
            text: desk.name,
            timestamp: Date.now(),
          },
        ]);
        describeBranchResponse(branch, { specificDesk: desk });
      }
      return;
    }
    if (item.action === 'review-booking' && item.branchKey && item.serviceId) {
      const branch = branchByKey.get(item.branchKey);
      const desk = branch?.desks.find((d) => d.serviceId === item.serviceId);
      if (branch && desk) {
        onSetMessages((prev) => [
          ...prev,
          {
            id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'user',
            text: 'Yes, prepare my booking',
            timestamp: Date.now(),
          },
        ]);
        onSetPendingIntent(null);
        pushAssistantMessage({
          text: `Ready when you are — review your details for ${desk.name} at ${branch.locationName}.`,
          reviewBookingTrigger: {
            branchKey: branch.branchKey,
            locationName: branch.locationName,
            serviceId: desk.serviceId,
            serviceName: desk.name,
          },
        });
      }
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingLockRef.current || bookingForm.isSubmitting) return;

    const cleanName = bookingForm.visitorName.trim();
    if (!cleanName) {
      onSetBookingForm((p) => ({ ...p, error: 'Please enter your name.' }));
      return;
    }
    if (!bookingForm.branchKey || !bookingForm.serviceId) {
      onSetBookingForm((p) => ({
        ...p,
        error: 'Please select both a branch and a service desk.',
      }));
      return;
    }

    bookingLockRef.current = true;
    onSetBookingForm((p) => ({ ...p, isSubmitting: true, error: '' }));

    try {
      const created = await onConfirmBooking({
        visitorName: cleanName,
        branchKey: bookingForm.branchKey,
        serviceId: bookingForm.serviceId,
        reason: bookingForm.reason.trim(),
      });

      const branch = branchByKey.get(bookingForm.branchKey);
      const desk = branch?.desks.find((d) => d.serviceId === bookingForm.serviceId);

      onSetBookingForm((p) => ({
        ...p,
        open: false,
        isSubmitting: false,
        error: '',
      }));

      pushAssistantMessage({
        text: `${desk?.name || 'Your desk'} at ${branch?.locationName || 'this branch'} is confirmed.`,
        confirmedTicket: {
          ticketId: created.id,
          ticketNumber: created.ticketNumber,
          branchKey: branch?.branchKey || bookingForm.branchKey,
          locationName: branch?.locationName || 'Bank Branch',
          serviceId: created.serviceId,
          serviceName: desk?.name || created.serviceId,
          categoryId: branch?.categoryId,
          isBankDesk: Boolean(branch?.isBankDesk),
        },
      });
    } catch (err) {
      onSetBookingForm((p) => ({
        ...p,
        isSubmitting: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to confirm booking right now. Please try again.',
      }));
    } finally {
      bookingLockRef.current = false;
    }
  };

  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    onSetDraft('');
    handleUserMessage(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable Centered Conversation Column */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className={`max-w-[82%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
                      isDark
                        ? 'bg-[#1D5434] text-white'
                        : 'bg-[#1B4332] text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              );
            }

            // Live lookup for confirmed ticket card
            const liveTicket = msg.confirmedTicket
              ? ticketById.get(msg.confirmedTicket.ticketId) ?? null
              : null;
            const livePos = msg.confirmedTicket
              ? getTicketPosition(msg.confirmedTicket.ticketId)
              : null;
            const confirmedBranch = msg.confirmedTicket
              ? branchByKey.get(msg.confirmedTicket.branchKey) ?? null
              : null;
            const confirmedDesk = confirmedBranch?.desks.find(
              (d) => d.serviceId === msg.confirmedTicket?.serviceId
            );

            return (
              <div key={msg.id} className="flex items-start gap-3">
                {/* Sparkle Assistant Avatar */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                    isDark
                      ? 'border-[#254B34] bg-[#10291A] text-[#6EE7A0]'
                      : 'border-[#B8DEC6] bg-[#E5F6EC] text-[#18603B]'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                  {/* Text Bubble */}
                  <div
                    className={`inline-block max-w-full rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed ${
                      isDark
                        ? 'border-[#1B3324] bg-[#0D1C13] text-[#EEF5F0]'
                        : 'border-[#E2DFD3] bg-white text-[#11281B]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Branch Announcements Surfaced Before Booking */}
                  {msg.announcements && msg.announcements.length > 0 && (
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                        isDark
                          ? 'border-[#3A4D22] bg-[#162111] text-[#D8F3B8]'
                          : 'border-[#C6DFCB] bg-[#EDF7F0] text-[#144329]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <div className="space-y-1">
                          {msg.announcements.map((ann) => (
                            <p key={ann.id}>
                              <strong className="font-semibold">{ann.scopeLabel}:</strong>{' '}
                              {ann.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Suggestions / Desk Options / Review Confirmation */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestions.map((s) => (
                        <button
                          key={`${msg.id}_${s.label}`}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                            s.action === 'review-booking'
                              ? isDark
                                ? 'border-[#389B61] bg-[#194A2E] text-[#DCF5E5] hover:bg-[#1F5A38]'
                                : 'border-[#8ACBA4] bg-[#DCF3E5] text-[#103823] hover:bg-[#CCEBD8]'
                              : isDark
                              ? 'border-[#1E3628] bg-[#0D1C13] text-[#CBE0D3] hover:border-[#348F59]'
                              : 'border-[#DCD9CD] bg-white text-[#143322] hover:border-[#8ACBA4] hover:bg-[#F2FAF5]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Review Booking Trigger Button */}
                  {msg.reviewBookingTrigger && !bookingForm.open && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          openInlineBookingForm(
                            msg.reviewBookingTrigger!.branchKey,
                            msg.reviewBookingTrigger!.serviceId,
                            msg.reviewBookingTrigger!.reason || ''
                          )
                        }
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors ${
                          isDark
                            ? 'bg-[#6EE7A0] text-[#052110] hover:bg-[#82EEAF]'
                            : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                        }`}
                      >
                        <TicketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Review booking</span>
                      </button>
                    </div>
                  )}

                  {/* Pre-booking Ask [Branch Name] Button */}
                  {msg.askBranch && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDeskChatForBranch({
                            branchKey: msg.askBranch!.branchKey,
                            locationName: msg.askBranch!.locationName,
                            serviceName: msg.askBranch!.serviceName,
                            serviceId: msg.askBranch!.queueServiceId,
                            categoryId: msg.askBranch!.categoryId,
                          })
                        }
                        className={`inline-flex min-h-[36px] items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                          isDark
                            ? 'border-[#264733] bg-[#0B1710] text-[#8CE2AE] hover:bg-[#13291C]'
                            : 'border-[#B8DEC6] bg-[#F2FAF5] text-[#144329] hover:bg-[#E2F4E9]'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ask {msg.askBranch.locationName}</span>
                      </button>
                    </div>
                  )}

                  {/* Confirmed Ticket Inline Card (Matching Reference Mockup Layout) */}
                  {msg.confirmedTicket && (
                    <div
                      className={`overflow-hidden rounded-2xl border p-5 ${
                        isDark
                          ? 'border-[#255438] bg-[#0B1910] shadow-[0_8px_28px_rgba(0,0,0,0.3)]'
                          : 'border-[#A7D8B9] bg-white shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                                isDark
                                  ? 'bg-[#153924] text-[#6EE7A0]'
                                  : 'bg-[#E2F4E9] text-[#18603B]'
                              }`}
                            >
                              <TicketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                isDark ? 'text-[#CBE0D3]' : 'text-[#18482E]'
                              }`}
                            >
                              Ticket confirmed
                            </span>
                          </div>

                          <p
                            className={`font-mono-tabular text-3xl font-bold tracking-tight ${
                              isDark ? 'text-white' : 'text-[#10281B]'
                            }`}
                          >
                            {msg.confirmedTicket.ticketNumber}
                          </p>

                          <p
                            className={`text-sm font-semibold ${
                              isDark ? 'text-[#EEF5F0]' : 'text-[#11281B]'
                            }`}
                          >
                            {msg.confirmedTicket.serviceName}
                          </p>
                          <p
                            className={`text-xs ${
                              isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                            }`}
                          >
                            {msg.confirmedTicket.locationName}
                          </p>

                          <p
                            className={`font-mono-tabular flex items-center gap-1.5 pt-0.5 text-xs ${
                              isDark ? 'text-[#9AB5A4]' : 'text-[#4B6356]'
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {(() => {
                                const st = liveTicket?.status || 'waiting';
                                if (st === 'cancelled') return 'Cancelled';
                                if (st === 'completed') return 'Completed';
                                if (st === 'called') return `Called${liveTicket?.counter ? ` · ${liveTicket.counter}` : ''}`;
                                if (st === 'serving') return `Serving${liveTicket?.counter ? ` · ${liveTicket.counter}` : ''}`;
                                if (confirmedDesk?.isPaused) return 'Waiting · Queue paused';
                                if (livePos) {
                                  return `Waiting · Position #${livePos.position} · About ${livePos.estimatedWaitMinutes} min`;
                                }
                                return 'Waiting · Wait estimate unavailable';
                              })()}
                            </span>
                          </p>
                        </div>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDeskChatForBranch({
                                branchKey: msg.confirmedTicket!.branchKey,
                                locationName: msg.confirmedTicket!.locationName,
                                serviceId: msg.confirmedTicket!.serviceId,
                                serviceName: msg.confirmedTicket!.serviceName,
                                categoryId: msg.confirmedTicket!.categoryId,
                                ticketId: msg.confirmedTicket!.ticketId,
                                ticketNumber: msg.confirmedTicket!.ticketNumber,
                              })
                            }
                            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors ${
                              isDark
                                ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                                : 'bg-[#CBEAD8] text-[#0F3923] hover:bg-[#B8E1C9]'
                            }`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {msg.confirmedTicket.isBankDesk
                                ? 'Chat with the bank desk'
                                : 'Chat with this desk'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <p
                        className={`mt-3 border-t pt-2.5 text-xs ${
                          isDark
                            ? 'border-[#162C1E] text-[#89A594]'
                            : 'border-[#ECE9DF] text-[#546E5F]'
                        }`}
                      >
                        {msg.confirmedTicket.isBankDesk
                          ? 'Chat directly with your bank desk and see important branch announcements.'
                          : 'Chat directly with this desk and see important branch announcements.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Compact Inline Review & Confirm Booking Form */}
          {bookingForm.open && (
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                  isDark
                    ? 'border-[#254B34] bg-[#10291A] text-[#6EE7A0]'
                    : 'border-[#B8DEC6] bg-[#E5F6EC] text-[#18603B]'
                }`}
              >
                <TicketIcon className="h-4 w-4" />
              </span>

              <form
                onSubmit={(e) => void handleSubmitForm(e)}
                aria-label="Review booking form"
                className={`w-full max-w-lg space-y-3.5 rounded-2xl border p-4 sm:p-5 ${
                  isDark
                    ? 'border-[#234731] bg-[#0D1C13] text-[#EEF5F0]'
                    : 'border-[#C5DEC9] bg-white text-[#11281B] shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold">Review booking</h3>
                  <button
                    type="button"
                    disabled={bookingForm.isSubmitting}
                    onClick={() => onSetBookingForm((p) => ({ ...p, open: false, error: '' }))}
                    className={`text-xs font-medium ${
                      isDark
                        ? 'text-[#89A594] hover:text-white'
                        : 'text-[#546E5F] hover:text-[#10281B]'
                    }`}
                  >
                    Close
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="qai-booking-name"
                    className="mb-1 block text-xs font-semibold"
                  >
                    Name
                  </label>
                  <input
                    id="qai-booking-name"
                    type="text"
                    required
                    maxLength={80}
                    disabled={bookingForm.isSubmitting}
                    value={bookingForm.visitorName}
                    onChange={(e) =>
                      onSetBookingForm((p) => ({ ...p, visitorName: e.target.value, error: '' }))
                    }
                    placeholder="Your full name"
                    className={`min-h-[40px] w-full rounded-xl border px-3 text-sm focus:outline-none ${
                      isDark
                        ? 'border-[#1E3628] bg-[#08130C] text-white focus:border-[#348F59]'
                        : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#11281B] focus:border-[#1B4332]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="qai-booking-branch"
                      className="mb-1 block text-xs font-semibold"
                    >
                      Branch
                    </label>
                    <select
                      id="qai-booking-branch"
                      disabled={bookingForm.isSubmitting}
                      value={bookingForm.branchKey}
                      onChange={(e) => {
                        const nextBranch = branchByKey.get(e.target.value);
                        const firstDesk =
                          nextBranch?.desks.find((d) => d.canBook) || nextBranch?.desks[0];
                        onSetBookingForm((p) => ({
                          ...p,
                          branchKey: e.target.value,
                          serviceId: firstDesk?.serviceId || '',
                          error: '',
                        }));
                      }}
                      className={`min-h-[40px] w-full rounded-xl border px-3 text-sm focus:outline-none ${
                        isDark
                          ? 'border-[#1E3628] bg-[#08130C] text-white focus:border-[#348F59]'
                          : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#11281B] focus:border-[#1B4332]'
                      }`}
                    >
                      {branches.map((b) => (
                        <option key={b.branchKey} value={b.branchKey}>
                          {b.locationName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="qai-booking-desk"
                      className="mb-1 block text-xs font-semibold"
                    >
                      Service / Desk
                    </label>
                    <select
                      id="qai-booking-desk"
                      disabled={bookingForm.isSubmitting}
                      value={bookingForm.serviceId}
                      onChange={(e) =>
                        onSetBookingForm((p) => ({ ...p, serviceId: e.target.value, error: '' }))
                      }
                      className={`min-h-[40px] w-full rounded-xl border px-3 text-sm focus:outline-none ${
                        isDark
                          ? 'border-[#1E3628] bg-[#08130C] text-white focus:border-[#348F59]'
                          : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#11281B] focus:border-[#1B4332]'
                      }`}
                    >
                      {(selectedFormBranch?.desks ?? []).map((d) => (
                        <option key={d.serviceId} value={d.serviceId}>
                          {d.name} ({d.waitDisplay})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="qai-booking-reason"
                    className="mb-1 block text-xs font-semibold"
                  >
                    Reason for visit <span className="font-normal opacity-75">(optional)</span>
                  </label>
                  <input
                    id="qai-booking-reason"
                    type="text"
                    maxLength={140}
                    disabled={bookingForm.isSubmitting}
                    value={bookingForm.reason}
                    onChange={(e) =>
                      onSetBookingForm((p) => ({ ...p, reason: e.target.value, error: '' }))
                    }
                    placeholder="e.g., KYC update or consultation"
                    className={`min-h-[40px] w-full rounded-xl border px-3 text-sm focus:outline-none ${
                      isDark
                        ? 'border-[#1E3628] bg-[#08130C] text-white focus:border-[#348F59]'
                        : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#11281B] focus:border-[#1B4332]'
                    }`}
                  />
                </div>

                {selectedFormBranch?.announcements && selectedFormBranch.announcements.length > 0 && (
                  <div
                    className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
                      isDark
                        ? 'bg-[#13291C] text-[#9BE6B8]'
                        : 'bg-[#EDF7F0] text-[#144329]'
                    }`}
                  >
                    <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{selectedFormBranch.announcements[0].message}</span>
                  </div>
                )}

                {selectedFormBranch?.desks.find((d) => d.serviceId === bookingForm.serviceId)
                  ?.isPaused && (
                  <div
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                      isDark
                        ? 'bg-[#3A280A] text-[#FDE68A]'
                        : 'bg-[#FEF3C7] text-[#92400E]'
                    }`}
                  >
                    <PauseCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>This desk is currently paused. Switch to another desk or retry later.</span>
                  </div>
                )}

                {bookingForm.error && (
                  <div
                    role="alert"
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                      isDark
                        ? 'border-[#7F1D1D] bg-[#241111] text-[#FCA5A5]'
                        : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                    }`}
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{bookingForm.error}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={bookingForm.isSubmitting}
                    className={`inline-flex min-h-[40px] items-center justify-center rounded-xl px-5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      isDark
                        ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                        : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                    }`}
                  >
                    {bookingForm.isSubmitting ? 'Booking...' : 'Confirm booking'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom-Anchored Composer */}
      <div className="px-4 pt-2 pb-5 sm:px-8">
        <form
          onSubmit={handleComposerSubmit}
          className={`mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border px-4 py-2 transition-colors ${
            isDark
              ? 'border-[#1E3628] bg-[#0A160E] focus-within:border-[#348F59]'
              : 'border-[#DCD9CD] bg-white shadow-xs focus-within:border-[#1B4332]'
          }`}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => onSetDraft(e.target.value)}
            placeholder="Ask about a branch, documents, or queue..."
            maxLength={500}
            aria-label="Ask about a branch, documents, or queue"
            className={`min-h-[40px] flex-1 bg-transparent text-sm focus:outline-none ${
              isDark
                ? 'text-white placeholder:text-[#6B8575]'
                : 'text-[#11281B] placeholder:text-[#6D8275]'
            }`}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send question"
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
  );
}
