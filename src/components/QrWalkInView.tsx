import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  Check,
  Clock,
  MapPin,
  Megaphone,
  PauseCircle,
  Share2,
  Ticket as TicketIcon,
  Users,
} from 'lucide-react';
import { useQueue } from '../context/QueueContext';
import {
  BANK_BRANCHES,
  DEMO_BRANCH_ID,
  DEMO_DESK_ID,
  findBankBranchByServiceId,
  getBankBranchById,
} from '../data/bankCatalog';
import { formatCounterTurnText } from './visitor/branchCatalog';
import { BankEmblem } from './BankEmblem';

interface QrWalkInViewProps {
  branchId: string;
  deskId: string;
  onBackToHomepage: () => void;
}

interface StoredQrTicketRef {
  ticketId: string;
  ticketNumber: string;
  serviceId: string;
  visitorName: string;
}

function getStorageKey(branchKey: string, serviceId: string): string {
  return `lineless_qr_ticket_v1:${branchKey}:${serviceId}`;
}

export function QrWalkInView({ branchId, deskId, onBackToHomepage }: QrWalkInViewProps) {
  const {
    services,
    queueFeed,
    announcements,
    joinAnonymousQrQueue,
    leaveAnonymousQrTicket,
    getTicketPosition,
    getServiceEstimatedWait,
  } = useQueue();

  const resolvedBranch = useMemo(() => {
    const direct = getBankBranchById(branchId);
    if (direct) return direct;
    const byDesk = findBankBranchByServiceId(deskId);
    if (byDesk) return byDesk.branch;
    return getBankBranchById(DEMO_BRANCH_ID) || BANK_BRANCHES[0];
  }, [branchId, deskId]);

  const defaultDesk = useMemo(() => {
    const matched = resolvedBranch.desks.find(
      (d) => d.queueServiceId === deskId || d.id === deskId
    );
    return matched || resolvedBranch.desks[0];
  }, [resolvedBranch, deskId]);

  const [selectedServiceId, setSelectedServiceId] = useState(
    defaultDesk?.queueServiceId || DEMO_DESK_ID
  );
  const [visitorNameInput, setVisitorNameInput] = useState('');
  const [savedTicketRef, setSavedTicketRef] = useState<StoredQrTicketRef | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    setSelectedServiceId(defaultDesk?.queueServiceId || DEMO_DESK_ID);
  }, [defaultDesk]);

  // Restore previously joined QR ticket for this branch/desk on reload (never auto-creates one!)
  useEffect(() => {
    const key = getStorageKey(resolvedBranch.id, selectedServiceId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setSavedTicketRef(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredQrTicketRef;
      if (parsed && parsed.ticketId) {
        setSavedTicketRef(parsed);
      } else {
        setSavedTicketRef(null);
      }
    } catch {
      setSavedTicketRef(null);
    }
  }, [resolvedBranch.id, selectedServiceId]);

  const selectedDeskMeta =
    resolvedBranch.desks.find((d) => d.queueServiceId === selectedServiceId) ||
    resolvedBranch.desks[0];

  const liveService = services.find((s) => s.id === selectedServiceId);
  const isPaused = Boolean(liveService?.isPaused);

  const waitingFeed = useMemo(
    () =>
      queueFeed
        .filter((f) => f.serviceId === selectedServiceId && f.status === 'waiting')
        .sort((a, b) => a.queueOrderAt - b.queueOrderAt),
    [queueFeed, selectedServiceId]
  );

  const nowServingFeed = useMemo(
    () =>
      queueFeed.filter(
        (f) =>
          f.serviceId === selectedServiceId &&
          (f.status === 'serving' || f.status === 'called')
      ),
    [queueFeed, selectedServiceId]
  );

  const activeTicketFeedItem = useMemo(() => {
    if (!savedTicketRef) return null;
    return queueFeed.find((f) => f.id === savedTicketRef.ticketId) ?? null;
  }, [queueFeed, savedTicketRef]);

  // Clear saved ticket if cancelled or not found after load
  useEffect(() => {
    if (!savedTicketRef) return;
    if (
      activeTicketFeedItem &&
      (activeTicketFeedItem.status === 'cancelled' || activeTicketFeedItem.status === 'completed')
    ) {
      // Keep completed briefly only if user is looking at it, or clear cancelled immediately
      if (activeTicketFeedItem.status === 'cancelled') {
        try {
          localStorage.removeItem(getStorageKey(resolvedBranch.id, selectedServiceId));
        } catch {
          // Ignore
        }
        setSavedTicketRef(null);
      }
    }
  }, [activeTicketFeedItem, resolvedBranch.id, savedTicketRef, selectedServiceId]);

  const branchDeskIds = useMemo(
    () => new Set(resolvedBranch.desks.map((d) => d.queueServiceId)),
    [resolvedBranch]
  );

  const branchAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) => a.serviceId === 'all' || branchDeskIds.has(a.serviceId)
      ),
    [announcements, branchDeskIds]
  );

  const ticketPosition = useMemo(
    () => (activeTicketFeedItem ? getTicketPosition(activeTicketFeedItem.id) : null),
    [activeTicketFeedItem, getTicketPosition]
  );

  const estWait = getServiceEstimatedWait(selectedServiceId);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isPaused) return;
    setErrorText('');
    setSubmitting(true);
    try {
      const created = await joinAnonymousQrQueue(
        selectedServiceId,
        visitorNameInput.trim() || 'Walk-in',
        selectedDeskMeta
          ? {
              id: selectedDeskMeta.queueServiceId,
              name: selectedDeskMeta.name,
              facility: resolvedBranch.displayName,
              locationDetail: resolvedBranch.address,
              prefix: selectedDeskMeta.prefix,
              avgServiceMinutes: selectedDeskMeta.avgServiceMinutes,
              counters: selectedDeskMeta.counters,
            }
          : undefined
      );
      if (!created) {
        setErrorText('Unable to join the queue right now. Please try again.');
        return;
      }
      const ref: StoredQrTicketRef = {
        ticketId: created.id,
        ticketNumber: created.ticketNumber,
        serviceId: created.serviceId,
        visitorName: created.visitorName,
      };
      try {
        localStorage.setItem(
          getStorageKey(resolvedBranch.id, selectedServiceId),
          JSON.stringify(ref)
        );
      } catch {
        // Ignore storage errors
      }
      setSavedTicketRef(ref);
      setVisitorNameInput('');
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Unable to join the queue right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!savedTicketRef || submitting) return;
    setSubmitting(true);
    try {
      await leaveAnonymousQrTicket(savedTicketRef.ticketId);
      try {
        localStorage.removeItem(getStorageKey(resolvedBranch.id, selectedServiceId));
      } catch {
        // Ignore
      }
      setSavedTicketRef(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareTicket = async () => {
    if (!activeTicketFeedItem) return;
    const shareUrl = window.location.href;
    const shareText = `LINELESS Ticket ${activeTicketFeedItem.ticketNumber} at ${resolvedBranch.displayName} (${selectedDeskMeta?.name || 'Customer Service'})`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ticket ${activeTicketFeedItem.ticketNumber}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // Fallback to clipboard copy
    }
    try {
      await navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Ignore clipboard failures
    }
  };

  const isCalledOrServing =
    activeTicketFeedItem?.status === 'called' || activeTicketFeedItem?.status === 'serving';

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#10281B]">
      {/* Minimal Header */}
      <header className="border-b border-[#E3E0D4] bg-[#F5F3EC]">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1F7045] text-white">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="2.4" rx="1" fill="currentColor" />
                <rect x="2" y="6.8" width="8.5" height="2.4" rx="1" fill="currentColor" opacity="0.82" />
                <rect x="2" y="10.6" width="5" height="2.4" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
            </span>
            <span className="font-display text-sm font-bold tracking-[0.06em] text-[#10281B]">
              LINELESS
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToHomepage}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#DCD9CD] bg-white px-3 text-xs font-medium text-[#375142] transition-colors hover:bg-[#F1EFE7]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Homepage</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-6 sm:py-10">
        {/* Branch Identity Card */}
        <section className="rounded-2xl border border-[#DFDDD2] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-start gap-3.5">
            <BankEmblem brand={resolvedBranch.brandId} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-[#18603B] uppercase">
                {resolvedBranch.bankName}
              </p>
              <h1 className="font-display mt-0.5 text-xl font-semibold text-[#10281B]">
                {resolvedBranch.branchName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#546B5E]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{resolvedBranch.address}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{resolvedBranch.hours}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Active Branch Announcements */}
          {branchAnnouncements.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#ECEAE1] pt-4">
              {branchAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-start gap-2.5 rounded-xl border border-[#BCE2CC] bg-[#E8F6EE] px-3.5 py-2.5 text-xs font-medium text-[#11482B]"
                >
                  <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{ann.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Live Ticket Screen vs Join Walk-in Screen */}
        {savedTicketRef && activeTicketFeedItem ? (
          <section className="space-y-4 rounded-2xl border border-[#BCE2CC] bg-white p-5 shadow-xs sm:p-6">
            {isCalledOrServing && (
              <div className="flex items-center gap-3 rounded-xl bg-[#1B4332] px-4 py-3.5 text-white">
                <BellRing className="h-5 w-5 shrink-0 text-[#7CEBA4]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">
                    {formatCounterTurnText(activeTicketFeedItem.counter)}
                  </p>
                  <p className="text-xs text-[#CBEAD8]">
                    Please walk up to {activeTicketFeedItem.counter || 'the assigned counter'} now.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2F4E9] px-2.5 py-1 text-xs font-semibold text-[#125532]">
                  <TicketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Walk-in ticket</span>
                </span>
                <p className="font-mono-tabular mt-3 text-4xl font-bold tracking-tight text-[#10281B]">
                  {activeTicketFeedItem.ticketNumber}
                </p>
                <p className="mt-1 text-sm font-medium text-[#375142]">
                  {savedTicketRef.visitorName || 'Walk-in'} · {selectedDeskMeta?.name}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  isCalledOrServing
                    ? 'bg-[#CBEAD8] text-[#0E4829]'
                    : activeTicketFeedItem.status === 'completed'
                    ? 'bg-[#EFECE3] text-[#4B6356]'
                    : isPaused
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-[#E2F4E9] text-[#156039]'
                }`}
              >
                {activeTicketFeedItem.status === 'waiting' && isPaused
                  ? 'Queue paused'
                  : activeTicketFeedItem.status}
              </span>
            </div>

            {activeTicketFeedItem.status === 'waiting' && ticketPosition && (
              <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-[#E5E3D9] bg-[#FAF8F2] p-3.5 text-center">
                <div>
                  <p className="text-[11px] font-medium text-[#546B5E]">Position</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#10281B]">
                    #{ticketPosition.position}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#546B5E]">People ahead</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#10281B]">
                    {ticketPosition.peopleAhead}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#546B5E]">Est. wait</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#18603B]">
                    {isPaused ? 'Paused' : `~${ticketPosition.estimatedWaitMinutes}m`}
                  </p>
                </div>
              </div>
            )}

            {activeTicketFeedItem.status === 'completed' && (
              <div className="rounded-xl border border-[#DFDDD2] bg-[#FAF8F2] p-4 text-sm text-[#375142]">
                Your visit at {resolvedBranch.branchName} is marked complete. Thank you for banking with us.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void handleShareTicket()}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#D4D1C5] bg-white px-4 text-sm font-semibold text-[#10281B] transition-colors hover:bg-[#F5F3EC]"
              >
                {shareCopied ? (
                  <>
                    <Check className="h-4 w-4 text-[#18603B]" aria-hidden="true" />
                    <span>Ticket link copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    <span>Share ticket</span>
                  </>
                )}
              </button>

              {activeTicketFeedItem.status === 'waiting' ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleLeaveQueue()}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#E5B8B8] bg-[#FFF5F5] px-4 text-sm font-semibold text-[#991B1B] transition-colors hover:bg-[#FEE2E2] disabled:opacity-50"
                >
                  Leave queue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(getStorageKey(resolvedBranch.id, selectedServiceId));
                    } catch {
                      // Ignore
                    }
                    setSavedTicketRef(null);
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#1B4332] px-4 text-sm font-semibold text-white"
                >
                  Join again
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-5 rounded-2xl border border-[#DFDDD2] bg-white p-5 shadow-xs sm:p-6">
            {/* Desk Selector if multiple desks exist */}
            <div>
              <p className="text-xs font-semibold text-[#546B5E]">Selected service desk</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {resolvedBranch.desks.map((desk) => {
                  const active = desk.queueServiceId === selectedServiceId;
                  return (
                    <button
                      key={desk.queueServiceId}
                      type="button"
                      onClick={() => setSelectedServiceId(desk.queueServiceId)}
                      className={`min-h-[36px] rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#1B4332] bg-[#1B4332] text-white'
                          : 'border-[#DCD9CD] bg-[#FAF8F2] text-[#375142] hover:bg-[#EFECE3]'
                      }`}
                    >
                      {desk.name}
                    </button>
                  );
                })}
              </div>
              {selectedDeskMeta && (
                <p className="mt-2.5 text-xs leading-relaxed text-[#546B5E]">
                  {selectedDeskMeta.description}
                </p>
              )}
            </div>

            {/* Live Desk Queue Summary */}
            <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-[#E5E3D9] bg-[#FAF8F2] p-3.5 text-center">
              <div>
                <p className="text-[11px] font-medium text-[#546B5E]">Now serving</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#10281B]">
                  {nowServingFeed[0]?.ticketNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#546B5E]">Waiting</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#10281B]">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#18603B]" aria-hidden="true" />
                    {waitingFeed.length}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#546B5E]">Est. wait</p>
                <p className="font-mono-tabular mt-0.5 text-base font-bold text-[#18603B]">
                  {isPaused ? 'Paused' : waitingFeed.length === 0 ? 'No wait' : `~${estWait} min`}
                </p>
              </div>
            </div>

            {isPaused && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] px-3.5 py-3 text-xs font-medium text-[#92400E]">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Queue paused. New walk-in joins are temporarily disabled at this desk.
                </span>
              </div>
            )}

            {errorText && (
              <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#991B1B]">
                {errorText}
              </div>
            )}

            {/* Join Form (No Login Required) */}
            <form onSubmit={handleJoinQueue} className="space-y-3.5">
              <div>
                <label htmlFor="qr-visitor-name" className="block text-xs font-semibold text-[#375142]">
                  Your name (optional)
                </label>
                <input
                  id="qr-visitor-name"
                  type="text"
                  value={visitorNameInput}
                  onChange={(e) => setVisitorNameInput(e.target.value)}
                  maxLength={60}
                  placeholder="Walk-in (default if left blank)"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#D4D1C5] bg-[#FAF8F2] px-3.5 text-sm text-[#10281B] placeholder:text-[#788D81] focus:border-[#1B4332] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || isPaused}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#143627] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <TicketIcon className="h-4 w-4" aria-hidden="true" />
                <span>{submitting ? 'Joining queue...' : 'Join queue'}</span>
              </button>
              <p className="text-center text-[11px] text-[#546B5E]">
                No account or sign-in required. Your live ticket updates right on this screen.
              </p>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
