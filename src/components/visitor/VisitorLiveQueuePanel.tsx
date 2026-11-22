import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, LogOut, PauseCircle, Users } from 'lucide-react';
import { QueueFeedItem, ServiceLocation, Ticket, TicketPositionInfo } from '../../types/queue';
import { VisitorBranchItem } from './branchCatalog';
import { VisitorThemeMode } from './types';

interface VisitorLiveQueuePanelProps {
  visitorTheme: VisitorThemeMode;
  branch: VisitorBranchItem | null;
  activeServiceId: string | null;
  onSelectPreviewService?: (serviceId: string) => void;
  attachedTicket: Ticket | null;
  services: ServiceLocation[];
  queueFeed: QueueFeedItem[];
  getTicketPosition: (ticketId: string) => TicketPositionInfo | null;
  onLeaveQueue: (ticketId: string) => Promise<void>;
  variant?: 'mobile' | 'desktop';
}

export function VisitorLiveQueuePanel({
  visitorTheme,
  branch,
  activeServiceId,
  onSelectPreviewService,
  attachedTicket,
  services,
  queueFeed,
  getTicketPosition,
  onLeaveQueue,
  variant,
}: VisitorLiveQueuePanelProps) {
  const isDark = visitorTheme === 'dark';
  const selectId = variant === 'mobile' ? 'live-queue-desk-select-mobile' : 'live-queue-desk-select';
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const myTicketRowRef = useRef<HTMLDivElement | null>(null);

  const resolvedServiceId = attachedTicket?.serviceId || activeServiceId || branch?.desks[0]?.serviceId || null;

  const liveService = useMemo(
    () => (resolvedServiceId ? services.find((s) => s.id === resolvedServiceId) ?? null : null),
    [resolvedServiceId, services]
  );

  const deskInfo = useMemo(
    () => branch?.desks.find((d) => d.serviceId === resolvedServiceId) ?? null,
    [branch, resolvedServiceId]
  );

  const nowServingItems = useMemo(() => {
    if (!resolvedServiceId) return [];
    return queueFeed
      .filter(
        (f) =>
          f.serviceId === resolvedServiceId &&
          (f.status === 'serving' || f.status === 'called')
      )
      .sort((a, b) => (a.calledAt ?? a.updatedAt) - (b.calledAt ?? b.updatedAt));
  }, [queueFeed, resolvedServiceId]);

  const waitingFeed = useMemo(() => {
    if (!resolvedServiceId) return [];
    return queueFeed
      .filter((f) => f.serviceId === resolvedServiceId && f.status === 'waiting')
      .sort((a, b) => a.queueOrderAt - b.queueOrderAt);
  }, [queueFeed, resolvedServiceId]);

  const positionInfo = useMemo(() => {
    if (!attachedTicket) return null;
    return getTicketPosition(attachedTicket.id);
  }, [attachedTicket, getTicketPosition]);

  useEffect(() => {
    setConfirmingLeave(false);
    setLeaveError('');
  }, [attachedTicket?.id]);

  // Auto-scroll visitor's own ticket into view in the waiting list
  useEffect(() => {
    if (myTicketRowRef.current) {
      myTicketRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [attachedTicket?.id, waitingFeed.length, mobileExpanded]);

  if (!resolvedServiceId && !branch) {
    return null;
  }

  const serviceName = liveService?.name || deskInfo?.name || 'Service Desk';
  const isPaused = Boolean(liveService?.isPaused);
  const isLiveQueue = Boolean(liveService);

  const waitLabel = (() => {
    if (isPaused) return 'Queue paused';
    if (!isLiveQueue) return 'Wait estimate unavailable';
    if (attachedTicket) {
      if (attachedTicket.status === 'called') return 'Called now';
      if (attachedTicket.status === 'serving') return 'Being served';
      if (attachedTicket.status === 'completed') return 'Completed';
      if (attachedTicket.status === 'cancelled') return 'Left queue';
      if (attachedTicket.status === 'deferred') return 'Deferred';
      if (positionInfo) return `About ${positionInfo.estimatedWaitMinutes} min`;
    }
    return deskInfo?.waitDisplay || 'Wait estimate unavailable';
  })();

  const handleConfirmLeave = async () => {
    if (!attachedTicket || leaving) return;
    setLeaving(true);
    setLeaveError('');
    try {
      await onLeaveQueue(attachedTicket.id);
      setConfirmingLeave(false);
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Unable to leave queue right now.');
    } finally {
      setLeaving(false);
    }
  };

  const panelBody = (
    <div className="flex h-full flex-col gap-4">
      {/* Desk Selector (only when pre-booking & branch has >1 desk) */}
      {!attachedTicket && branch && branch.desks.length > 1 && onSelectPreviewService && (
        <div>
          <label
            htmlFor={selectId}
            className={`mb-1 block text-[11px] font-semibold tracking-wide uppercase ${
              isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
            }`}
          >
            Desk
          </label>
          <select
            id={selectId}
            value={resolvedServiceId || ''}
            onChange={(e) => onSelectPreviewService(e.target.value)}
            className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium focus:outline-none ${
              isDark
                ? 'border-[#1E3628] bg-[#0B1710] text-[#E6EFE9]'
                : 'border-[#DCD9CD] bg-white text-[#11281B]'
            }`}
          >
            {branch.desks.map((d) => (
              <option key={d.serviceId} value={d.serviceId}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Now Serving */}
      <div
        className={`rounded-xl border p-3.5 ${
          isDark ? 'border-[#1B3324] bg-[#0D1C13]' : 'border-[#E3E0D4] bg-white'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-semibold tracking-wide uppercase ${
              isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
            }`}
          >
            Now serving
          </span>
          {isPaused && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                isDark ? 'bg-[#3A280A] text-[#FDE68A]' : 'bg-[#FEF3C7] text-[#92400E]'
              }`}
            >
              <PauseCircle className="h-3 w-3" aria-hidden="true" />
              Paused
            </span>
          )}
        </div>

        {nowServingItems.length === 0 ? (
          <p
            className={`mt-2 text-xs font-medium ${
              isDark ? 'text-[#8EA797]' : 'text-[#5A7264]'
            }`}
          >
            No tickets being called right now
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {nowServingItems.map((item) => {
              const isMine = attachedTicket?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                    isMine
                      ? isDark
                        ? 'border border-[#348F59] bg-[#164228]'
                        : 'border border-[#9BD3B1] bg-[#E2F4E9]'
                      : isDark
                      ? 'bg-[#08130C]'
                      : 'bg-[#F8F6F0]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono-tabular text-base font-bold ${
                        isDark ? 'text-white' : 'text-[#10281B]'
                      }`}
                    >
                      {item.ticketNumber}
                    </span>
                    {isMine && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isDark
                            ? 'bg-[#2EA45F] text-[#052110]'
                            : 'bg-[#1B4332] text-white'
                        }`}
                      >
                        You
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isDark ? 'text-[#8CE2AE]' : 'text-[#1D6B44]'
                    }`}
                  >
                    {item.counter || (item.status === 'serving' ? 'Serving' : 'Called')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visitor Ticket Summary OR Desk Waiting Summary */}
      <div
        className={`rounded-xl border p-3.5 ${
          isDark ? 'border-[#1B3324] bg-[#0D1C13]' : 'border-[#E3E0D4] bg-white'
        }`}
      >
        {attachedTicket ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-[11px] font-semibold tracking-wide uppercase ${
                    isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                  }`}
                >
                  Your ticket
                </p>
                <p
                  className={`font-mono-tabular text-xl font-bold ${
                    isDark ? 'text-white' : 'text-[#10281B]'
                  }`}
                >
                  {attachedTicket.ticketNumber}
                </p>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                  attachedTicket.status === 'called' || attachedTicket.status === 'serving'
                    ? isDark
                      ? 'bg-[#2EA45F] text-[#052110]'
                      : 'bg-[#1B4332] text-white'
                    : isDark
                    ? 'bg-[#152D1E] text-[#8CE2AE]'
                    : 'bg-[#E2F4E9] text-[#103823]'
                }`}
              >
                {attachedTicket.status}
              </span>
            </div>

            <div
              className={`grid grid-cols-3 gap-2 border-t pt-2.5 text-xs ${
                isDark ? 'border-[#182E20]' : 'border-[#ECE9DF]'
              }`}
            >
              <div>
                <span className={isDark ? 'text-[#86A090]' : 'text-[#5B7063]'}>Position</span>
                <p
                  className={`font-mono-tabular mt-0.5 font-bold ${
                    isDark ? 'text-white' : 'text-[#10281B]'
                  }`}
                >
                  {attachedTicket.status === 'waiting' && positionInfo
                    ? `#${positionInfo.position}`
                    : '—'}
                </p>
              </div>
              <div>
                <span className={isDark ? 'text-[#86A090]' : 'text-[#5B7063]'}>Ahead</span>
                <p
                  className={`font-mono-tabular mt-0.5 font-bold ${
                    isDark ? 'text-white' : 'text-[#10281B]'
                  }`}
                >
                  {attachedTicket.status === 'waiting' && positionInfo
                    ? `${positionInfo.peopleAhead}`
                    : '0'}
                </p>
              </div>
              <div>
                <span className={isDark ? 'text-[#86A090]' : 'text-[#5B7063]'}>Est. wait</span>
                <p
                  className={`font-mono-tabular mt-0.5 font-semibold ${
                    isPaused
                      ? isDark
                        ? 'text-[#FDE68A]'
                        : 'text-[#92400E]'
                      : isDark
                      ? 'text-[#8CE2AE]'
                      : 'text-[#1D6B44]'
                  }`}
                >
                  {attachedTicket.status === 'waiting' && positionInfo && !isPaused
                    ? `${positionInfo.estimatedWaitMinutes}m`
                    : isPaused
                    ? 'Paused'
                    : waitLabel}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Users
                className={`h-4 w-4 ${isDark ? 'text-[#8CE2AE]' : 'text-[#1D6B44]'}`}
                aria-hidden="true"
              />
              <span className={`font-mono-tabular font-semibold ${isDark ? 'text-white' : 'text-[#10281B]'}`}>
                {waitingFeed.length} waiting
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock
                className={`h-3.5 w-3.5 ${isDark ? 'text-[#86A090]' : 'text-[#5B7063]'}`}
                aria-hidden="true"
              />
              <span
                className={`font-mono-tabular font-medium ${
                  isDark ? 'text-[#8CE2AE]' : 'text-[#1D6B44]'
                }`}
              >
                {waitLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Waiting Line (Ticket numbers only, strictly no PII) */}
      <div
        className={`flex min-h-[160px] flex-1 flex-col overflow-hidden rounded-xl border ${
          isDark ? 'border-[#1B3324] bg-[#0D1C13]' : 'border-[#E3E0D4] bg-white'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b px-3.5 py-2.5 ${
            isDark ? 'border-[#182E20]' : 'border-[#ECE9DF]'
          }`}
        >
          <span
            className={`text-[11px] font-semibold tracking-wide uppercase ${
              isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
            }`}
          >
            Waiting line
          </span>
          <span
            className={`font-mono-tabular text-[11px] font-semibold ${
              isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
            }`}
          >
            {waitingFeed.length}
          </span>
        </div>

        <div
          className={`max-h-[260px] flex-1 divide-y overflow-y-auto lg:max-h-none ${
            isDark ? 'divide-[#182E20]' : 'divide-[#ECE9DF]'
          }`}
        >
          {waitingFeed.length === 0 ? (
            <div className="p-5 text-center">
              <p
                className={`text-xs font-medium ${
                  isDark ? 'text-[#8EA797]' : 'text-[#5A7264]'
                }`}
              >
                {isLiveQueue ? 'No tickets waiting in line.' : 'Live line unavailable for this desk.'}
              </p>
            </div>
          ) : (
            waitingFeed.map((item, idx) => {
              const isMine = attachedTicket?.id === item.id;
              return (
                <div
                  key={item.id}
                  ref={isMine ? myTicketRowRef : null}
                  className={`flex items-center justify-between px-3.5 py-2.5 text-xs ${
                    isDark ? 'border-[#182E20]' : 'border-[#ECE9DF]'
                  } ${
                    isMine
                      ? isDark
                        ? 'bg-[#153924]'
                        : 'bg-[#E5F6EC]'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono-tabular w-5 text-[11px] font-medium ${
                        isDark ? 'text-[#7B9786]' : 'text-[#6A8073]'
                      }`}
                    >
                      {idx + 1}.
                    </span>
                    <span
                      className={`font-mono-tabular text-sm font-bold ${
                        isMine
                          ? isDark
                            ? 'text-white'
                            : 'text-[#0E331F]'
                          : isDark
                          ? 'text-[#DCE7E0]'
                          : 'text-[#11281B]'
                      }`}
                    >
                      {item.ticketNumber}
                    </span>
                  </div>

                  {isMine ? (
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        isDark
                          ? 'bg-[#2EA45F] text-[#052110]'
                          : 'bg-[#1B4332] text-white'
                      }`}
                    >
                      You
                    </span>
                  ) : (
                    <span className={isDark ? 'text-[#7B9786]' : 'text-[#6A8073]'}>Waiting</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Leave Queue Button for Eligible Waiting Ticket */}
      {attachedTicket && attachedTicket.status === 'waiting' && (
        <div className="space-y-2">
          {leaveError && (
            <p className="text-xs font-medium text-[#B91C1C]">{leaveError}</p>
          )}
          {confirmingLeave ? (
            <div
              className={`space-y-2 rounded-xl border p-3 ${
                isDark
                  ? 'border-[#5C2323] bg-[#211010] text-[#FCA5A5]'
                  : 'border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]'
              }`}
            >
              <p className="text-xs font-medium">
                Leave queue for <span className="font-mono-tabular font-bold">{attachedTicket.ticketNumber}</span>? Your spot will be released.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => void handleConfirmLeave()}
                  className="flex-1 rounded-lg bg-[#B91C1C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#991B1B] disabled:opacity-50"
                >
                  {leaving ? 'Leaving...' : 'Confirm leave'}
                </button>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => setConfirmingLeave(false)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    isDark
                      ? 'border-[#2B4335] bg-[#0B1710] text-[#DCE7E0]'
                      : 'border-[#D4D1C5] bg-white text-[#11281B]'
                  }`}
                >
                  Keep spot
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingLeave(true)}
              className={`flex min-h-[38px] w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-colors ${
                isDark
                  ? 'border-[#253D2E] bg-[#0B1710] text-[#E0B4B4] hover:border-[#7F1D1D] hover:bg-[#231212] hover:text-[#FCA5A5]'
                  : 'border-[#DCD9CD] bg-white text-[#546B5E] hover:border-[#FCA5A5] hover:bg-[#FEF2F2] hover:text-[#B91C1C]'
              }`}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Leave queue</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant !== 'desktop' && (
        <div
          className={`border-b lg:hidden ${
            isDark ? 'border-[#172B1E] bg-[#0A160E]' : 'border-[#E3E0D4] bg-[#F6F4EC]'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            aria-expanded={mobileExpanded}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold tracking-wide uppercase ${
                    isDark ? 'text-[#8CE2AE]' : 'text-[#1B4332]'
                  }`}
                >
                  Live Queue
                </span>
                <span className={`truncate text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                  · {serviceName}
                </span>
              </div>
              <p
                className={`font-mono-tabular mt-0.5 text-xs ${
                  isDark ? 'text-[#DCE7E0]' : 'text-[#11281B]'
                }`}
              >
                {nowServingItems[0]
                  ? `Now serving ${nowServingItems[0].ticketNumber}`
                  : 'No active call'}{' '}
                · {waitingFeed.length} waiting
                {attachedTicket && positionInfo && attachedTicket.status === 'waiting'
                  ? ` · You #${positionInfo.position}`
                  : ''}
              </p>
            </div>
            {mobileExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>

          {mobileExpanded && <div className="px-4 pb-4">{panelBody}</div>}
        </div>
      )}

      {variant !== 'mobile' && (
        <aside
          aria-label="Live Queue"
          className={`hidden w-[300px] shrink-0 flex-col border-l p-4 lg:flex xl:w-[320px] ${
            isDark ? 'border-[#172B1E] bg-[#09150D]' : 'border-[#E3E0D4] bg-[#F6F4EC]'
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2
                className={`font-display text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#10281B]'
                }`}
              >
                Live Queue
              </h2>
              <p
                className={`truncate text-xs ${
                  isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                }`}
              >
                {serviceName}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{panelBody}</div>
        </aside>
      )}
    </>
  );
}
