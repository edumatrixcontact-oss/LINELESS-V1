import { useState } from 'react';
import {
  Check,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  TicketBookingMeta,
  buildGoogleMapsDirectionsUrl,
  findCatalogMatchByServiceId,
} from '../../data/discoveryCatalog';
import { ServiceLocation, Ticket, TicketPositionInfo } from '../../types/queue';
import { VisitorThemeMode } from './types';
import { shareTicketDetails } from './visitorStorage';

interface VisitorMyTicketsProps {
  visitorTheme: VisitorThemeMode;
  activeTickets: Ticket[];
  pastTickets: Ticket[];
  ticketMetaMap: Record<string, TicketBookingMeta>;
  getServiceById: (id: string) => ServiceLocation | undefined;
  getTicketPosition: (ticketId: string) => TicketPositionInfo | null;
  onLeaveQueue: (ticketId: string) => Promise<void>;
  onOpenDeskChatForTicket: (ticket: Ticket) => void;
  onGoToQueueAI: () => void;
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTicketStatusLabel(status: Ticket['status'], isPaused?: boolean): string {
  if (status === 'deferred') return 'Missed / Deferred';
  if (status === 'waiting' && isPaused) return 'Waiting · Queue paused';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function VisitorMyTickets({
  visitorTheme,
  activeTickets,
  pastTickets,
  ticketMetaMap,
  getServiceById,
  getTicketPosition,
  onLeaveQueue,
  onOpenDeskChatForTicket,
  onGoToQueueAI,
}: VisitorMyTicketsProps) {
  const isDark = visitorTheme === 'dark';
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPastTicket, setSelectedPastTicket] = useState<Ticket | null>(null);

  const handleConfirmLeave = async (ticketId: string) => {
    setLeavingId(ticketId);
    try {
      await onLeaveQueue(ticketId);
      setConfirmLeaveId(null);
    } finally {
      setLeavingId(null);
    }
  };

  const handleShare = async (params: {
    id: string;
    ticketNumber: string;
    serviceName: string;
    locationName: string;
    status: string;
    estimatedWaitMinutes?: number | null;
    position?: number | null;
    counter?: string | null;
  }) => {
    const res = await shareTicketDetails(params);
    if (res === 'copied' || res === 'shared') {
      setCopiedId(params.id);
      setTimeout(() => setCopiedId((curr) => (curr === params.id ? null : curr)), 2400);
    }
  };

  const resolveTicketDetails = (ticket: Ticket) => {
    const svc = getServiceById(ticket.serviceId);
    const meta = ticketMetaMap[ticket.id];
    const match = findCatalogMatchByServiceId(ticket.serviceId);
    const locationName =
      meta?.locationName || match?.location.name || svc?.facility || 'Bank Branch';
    const serviceName =
      meta?.subServiceName || match?.subService.name || svc?.name || ticket.serviceId;
    const address =
      meta?.locationAddress || match?.location.address || svc?.locationDetail;
    const mapsUrl = match ? buildGoogleMapsDirectionsUrl(match.location) : null;

    return { svc, meta, locationName, serviceName, address, mapsUrl };
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-7 sm:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1
            className={`font-display text-2xl font-bold tracking-tight sm:text-3xl ${
              isDark ? 'text-white' : 'text-[#10281B]'
            }`}
          >
            My Tickets
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}>
            Track active queue tickets or review past visits.
          </p>
        </div>

        {/* Active / History Segmented Switch */}
        <div
          role="tablist"
          aria-label="Ticket filter"
          className={`inline-flex shrink-0 self-start rounded-full border p-1 ${
            isDark
              ? 'border-[#1E3628] bg-[#0B1710]'
              : 'border-[#DCD9CD] bg-[#EFECE3]'
          }`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'active'}
            onClick={() => setTab('active')}
            className={`min-h-[34px] rounded-full px-4 text-xs font-semibold transition-colors ${
              tab === 'active'
                ? isDark
                  ? 'bg-[#1D5434] text-white'
                  : 'bg-[#1B4332] text-white'
                : isDark
                ? 'text-[#8FA899] hover:text-white'
                : 'text-[#4B6356] hover:text-[#10281B]'
            }`}
          >
            Active ({activeTickets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={`min-h-[34px] rounded-full px-4 text-xs font-semibold transition-colors ${
              tab === 'history'
                ? isDark
                  ? 'bg-[#1D5434] text-white'
                  : 'bg-[#1B4332] text-white'
                : isDark
                ? 'text-[#8FA899] hover:text-white'
                : 'text-[#4B6356] hover:text-[#10281B]'
            }`}
          >
            History ({pastTickets.length})
          </button>
        </div>
      </div>

      {/* ACTIVE TICKETS */}
      {tab === 'active' &&
        (activeTickets.length === 0 ? (
          <div
            className={`rounded-2xl border p-10 text-center ${
              isDark
                ? 'border-[#1B3324] bg-[#0B1710]'
                : 'border-[#E2DFD3] bg-white'
            }`}
          >
            <p
              className={`font-display text-lg font-semibold ${
                isDark ? 'text-white' : 'text-[#10281B]'
              }`}
            >
              No active queue tickets
            </p>
            <p className={`mt-1 text-sm ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}>
              Ask Queue AI to check wait times and book your spot in line.
            </p>
            <button
              type="button"
              onClick={onGoToQueueAI}
              className={`mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl px-5 text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                  : 'bg-[#1B4332] text-white hover:bg-[#143627]'
              }`}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Book with Queue AI</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {activeTickets.map((ticket) => {
              const { svc, meta, locationName, serviceName, mapsUrl } =
                resolveTicketDetails(ticket);
              const pos = getTicketPosition(ticket.id);
              const isPaused = Boolean(svc?.isPaused);

              return (
                <article
                  key={ticket.id}
                  className={`overflow-hidden rounded-2xl border p-5 sm:px-6 ${
                    isDark
                      ? 'border-[#1B3324] bg-[#0B1710]'
                      : 'border-[#E2DFD3] bg-white'
                  }`}
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`font-mono-tabular text-2xl font-bold ${
                            isDark ? 'text-white' : 'text-[#10281B]'
                          }`}
                        >
                          {ticket.ticketNumber}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            ticket.status === 'called' || ticket.status === 'serving'
                              ? isDark
                                ? 'bg-[#2EA45F] text-[#052110]'
                                : 'bg-[#1B4332] text-white'
                              : isPaused
                              ? isDark
                                ? 'bg-[#3A280A] text-[#FDE68A]'
                                : 'bg-[#FEF3C7] text-[#92400E]'
                              : isDark
                              ? 'bg-[#153924] text-[#8CE2AE]'
                              : 'bg-[#E2F4E9] text-[#103823]'
                          }`}
                        >
                          {formatTicketStatusLabel(ticket.status, isPaused)}
                        </span>
                        {ticket.counter && (
                          <span
                            className={`text-xs font-semibold ${
                              isDark ? 'text-[#8CE2AE]' : 'text-[#18603B]'
                            }`}
                          >
                            {ticket.counter}
                          </span>
                        )}
                      </div>

                      <p
                        className={`font-display text-base font-semibold ${
                          isDark ? 'text-[#EEF5F0]' : 'text-[#10281B]'
                        }`}
                      >
                        {serviceName}
                      </p>

                      <div
                        className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${
                          isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{locationName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Booked {formatDate(ticket.createdAt)}</span>
                        </span>
                      </div>

                      {meta?.reason && (
                        <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546E5F]'}`}>
                          Note: {meta.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      {ticket.status === 'waiting' && (
                        <div className="text-left sm:text-right">
                          <p
                            className={`font-mono-tabular text-sm font-bold ${
                              isPaused
                                ? isDark
                                  ? 'text-[#FDE68A]'
                                  : 'text-[#92400E]'
                                : isDark
                                ? 'text-[#8CE2AE]'
                                : 'text-[#18603B]'
                            }`}
                          >
                            {isPaused
                              ? 'Queue paused'
                              : pos
                              ? `Position #${pos.position} · ~${pos.estimatedWaitMinutes} min`
                              : 'Wait estimate unavailable'}
                          </p>
                          {pos && !isPaused && (
                            <p
                              className={`text-xs ${
                                isDark ? 'text-[#89A594]' : 'text-[#546E5F]'
                              }`}
                            >
                              {pos.peopleAhead} {pos.peopleAhead === 1 ? 'person' : 'people'} ahead
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDeskChatForTicket(ticket)}
                          className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors ${
                            isDark
                              ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                              : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Open Desk Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleShare({
                              id: ticket.id,
                              ticketNumber: ticket.ticketNumber,
                              serviceName,
                              locationName,
                              status: ticket.status,
                              estimatedWaitMinutes: pos?.estimatedWaitMinutes ?? null,
                              position: pos?.position ?? null,
                              counter: ticket.counter,
                            })
                          }
                          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                            isDark
                              ? 'border-[#1E3628] bg-[#0D1C13] text-[#CBE0D3] hover:bg-[#14291C]'
                              : 'border-[#DCD9CD] bg-[#FAF9F5] text-[#11281B] hover:bg-[#EFECE3]'
                          }`}
                        >
                          {copiedId === ticket.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Share</span>
                            </>
                          )}
                        </button>

                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                              isDark
                                ? 'border-[#1E3628] bg-[#0D1C13] text-[#8CE2AE] hover:bg-[#14291C]'
                                : 'border-[#DCD9CD] bg-[#FAF9F5] text-[#18603B] hover:bg-[#EFECE3]'
                            }`}
                          >
                            <span>Directions</span>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {ticket.status === 'waiting' && (
                    <div
                      className={`mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3 ${
                        isDark ? 'border-[#172B1E]' : 'border-[#ECE9DF]'
                      }`}
                    >
                      {confirmLeaveId === ticket.id ? (
                        <>
                          <span
                            className={`text-xs font-medium ${
                              isDark ? 'text-[#FCA5A5]' : 'text-[#991B1B]'
                            }`}
                          >
                            Release your spot?
                          </span>
                          <button
                            type="button"
                            disabled={leavingId === ticket.id}
                            onClick={() => void handleConfirmLeave(ticket.id)}
                            className="min-h-[32px] rounded-lg bg-[#B91C1C] px-3 text-xs font-semibold text-white hover:bg-[#991B1B] disabled:opacity-50"
                          >
                            {leavingId === ticket.id ? 'Leaving...' : 'Confirm leave'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmLeaveId(null)}
                            className={`min-h-[32px] rounded-lg border px-3 text-xs font-medium ${
                              isDark
                                ? 'border-[#1E3628] text-[#CBE0D3]'
                                : 'border-[#DCD9CD] text-[#3B5245]'
                            }`}
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmLeaveId(ticket.id)}
                          className={`text-xs font-semibold transition-colors ${
                            isDark
                              ? 'text-[#89A594] hover:text-[#FCA5A5]'
                              : 'text-[#546B5E] hover:text-[#B91C1C]'
                          }`}
                        >
                          Leave queue
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ))}

      {/* HISTORY TAB */}
      {tab === 'history' &&
        (pastTickets.length === 0 ? (
          <div
            className={`rounded-2xl border p-10 text-center ${
              isDark
                ? 'border-[#1B3324] bg-[#0B1710]'
                : 'border-[#E2DFD3] bg-white'
            }`}
          >
            <p
              className={`font-display text-lg font-semibold ${
                isDark ? 'text-white' : 'text-[#10281B]'
              }`}
            >
              No ticket history yet
            </p>
            <p className={`mt-1 text-sm ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}>
              Completed, cancelled, and missed queue visits appear here.
            </p>
          </div>
        ) : (
          <div
            className={`divide-y overflow-hidden rounded-2xl border ${
              isDark
                ? 'divide-[#172B1E] border-[#1B3324] bg-[#0B1710]'
                : 'divide-[#ECE9DF] border-[#E2DFD3] bg-white'
            }`}
          >
            {pastTickets.map((ticket) => {
              const { locationName, serviceName } = resolveTicketDetails(ticket);
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedPastTicket(ticket)}
                  className={`flex w-full flex-col justify-between gap-3 px-5 py-4 text-left transition-colors sm:flex-row sm:items-center sm:px-6 ${
                    isDark ? 'hover:bg-[#102217]' : 'hover:bg-[#FAF8F2]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`font-mono-tabular text-lg font-bold ${
                          isDark ? 'text-white' : 'text-[#10281B]'
                        }`}
                      >
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isDark ? 'text-[#DCE7E0]' : 'text-[#143322]'
                        }`}
                      >
                        {serviceName}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          ticket.status === 'completed'
                            ? isDark
                              ? 'bg-[#153924] text-[#8CE2AE]'
                              : 'bg-[#E2F4E9] text-[#103823]'
                            : isDark
                            ? 'bg-[#17281E] text-[#9AB5A4]'
                            : 'bg-[#F2F0E8] text-[#546B5E]'
                        }`}
                      >
                        {formatTicketStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}`}>
                      {locationName} · {formatDateTime(ticket.updatedAt)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      isDark ? 'text-[#8CE2AE]' : 'text-[#1B4332]'
                    }`}
                  >
                    View details
                  </span>
                </button>
              );
            })}
          </div>
        ))}

      {/* Past Ticket Detail Modal */}
      {selectedPastTicket &&
        (() => {
          const { locationName, serviceName, address, meta } =
            resolveTicketDetails(selectedPastTicket);
          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Ticket ${selectedPastTicket.ticketNumber} details`}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
              onClick={() => setSelectedPastTicket(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-2xl ${
                  isDark
                    ? 'border-[#1E3828] bg-[#0B1710] text-[#EEF5F0]'
                    : 'border-[#DCD9CD] bg-white text-[#10281B]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`font-mono-tabular text-2xl font-bold ${
                        isDark ? 'text-white' : 'text-[#10281B]'
                      }`}
                    >
                      {selectedPastTicket.ticketNumber}
                    </span>
                    <p className="mt-0.5 text-sm font-semibold">{serviceName}</p>
                    <p className={`text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}`}>
                      {locationName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPastTicket(null)}
                    aria-label="Close ticket details"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F2F0E8]'
                    }`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <dl
                  className={`grid grid-cols-2 gap-3 border-t pt-4 text-xs ${
                    isDark ? 'border-[#182E20]' : 'border-[#ECE9DF]'
                  }`}
                >
                  <div>
                    <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Final status</dt>
                    <dd className="mt-0.5 font-semibold">
                      {formatTicketStatusLabel(selectedPastTicket.status)}
                    </dd>
                  </div>
                  <div>
                    <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Counter</dt>
                    <dd className="mt-0.5 font-semibold">
                      {selectedPastTicket.counter || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Booked</dt>
                    <dd className="font-mono-tabular mt-0.5 font-medium">
                      {formatDateTime(selectedPastTicket.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Last updated</dt>
                    <dd className="font-mono-tabular mt-0.5 font-medium">
                      {formatDateTime(selectedPastTicket.updatedAt)}
                    </dd>
                  </div>
                  {address && (
                    <div className="col-span-2">
                      <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Address</dt>
                      <dd className="mt-0.5 font-medium">{address}</dd>
                    </div>
                  )}
                  {meta?.reason && (
                    <div className="col-span-2">
                      <dt className={isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}>Reason for visit</dt>
                      <dd className="mt-0.5 font-medium">{meta.reason}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedPastTicket;
                      setSelectedPastTicket(null);
                      onOpenDeskChatForTicket(target);
                    }}
                    className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-4 text-xs font-semibold ${
                      isDark
                        ? 'border-[#254B34] bg-[#10291A] text-[#8CE2AE]'
                        : 'border-[#B8DEC6] bg-[#F2FAF5] text-[#144329]'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Open Desk Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPastTicket(null)}
                    className={`min-h-[38px] rounded-xl px-4 text-xs font-semibold ${
                      isDark
                        ? 'bg-[#73E8A4] text-[#052110]'
                        : 'bg-[#1B4332] text-white'
                    }`}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
