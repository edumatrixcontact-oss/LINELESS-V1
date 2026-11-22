import { useMemo, useState } from 'react';
import { CheckCircle2, History, Search } from 'lucide-react';
import { BankBranchCatalogItem } from '../../data/bankCatalog';
import { ThemeMode, Ticket } from '../../types/queue';

interface StaffVisitHistoryProps {
  staffTheme: ThemeMode;
  branch: BankBranchCatalogItem;
  branchTickets: Ticket[];
  reasonLookup: (ticket: Ticket) => string | undefined;
}

type HistoryFilterStatus = 'all' | 'completed' | 'cancelled' | 'deferred';

export function StaffVisitHistory({
  staffTheme,
  branch,
  branchTickets,
  reasonLookup,
}: StaffVisitHistoryProps) {
  const isDark = staffTheme === 'dark';

  const [deskFilter, setDeskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<HistoryFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const deskNameById = useMemo(
    () => new Map(branch.desks.map((d) => [d.queueServiceId, d.name])),
    [branch.desks]
  );

  const historicalTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchTickets
      .filter(
        (t) =>
          t.status === 'completed' || t.status === 'cancelled' || t.status === 'deferred'
      )
      .filter((t) => deskFilter === 'all' || t.serviceId === deskFilter)
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => {
        if (!q) return true;
        const reason = (reasonLookup(t) || '').toLowerCase();
        return (
          t.ticketNumber.toLowerCase().includes(q) ||
          (t.visitorName || '').toLowerCase().includes(q) ||
          reason.includes(q)
        );
      })
      .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
  }, [branchTickets, deskFilter, reasonLookup, searchQuery, statusFilter]);

  const selectedTicket = useMemo(
    () => historicalTickets.find((t) => t.id === selectedId) ?? historicalTickets[0] ?? null,
    [historicalTickets, selectedId]
  );

  const formatTimestamp = (ms: number | null) => {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
          isDark ? 'border-[#193022] bg-[#0B1A11]' : 'border-[#E3E0D4] bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {branch.desks.length > 1 && (
            <select
              aria-label="Filter by bank desk"
              value={deskFilter}
              onChange={(e) => setDeskFilter(e.target.value)}
              className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold focus:outline-none ${
                isDark
                  ? 'border-[#213E2C] bg-[#08130C] text-white'
                  : 'border-[#DCD9CD] bg-[#FAF8F2] text-[#10281B]'
              }`}
            >
              <option value="all">All desks</option>
              {branch.desks.map((d) => (
                <option key={d.queueServiceId} value={d.queueServiceId}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {(['all', 'completed', 'deferred', 'cancelled'] as HistoryFilterStatus[]).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? isDark
                      ? 'border-[#348F59] bg-[#164228] text-white'
                      : 'border-[#1B4332] bg-[#E2F4E9] text-[#103823]'
                    : isDark
                    ? 'border-[#1C3525] bg-[#08130C] text-[#9AB3A4]'
                    : 'border-[#DFDDD2] bg-[#FAF8F2] text-[#4D5E52]'
                }`}
              >
                {st === 'deferred' ? 'Missed' : st}
              </button>
            )
          )}
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search
            className={`pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 ${
              isDark ? 'text-[#7B9685]' : 'text-[#607769]'
            }`}
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket or visitor..."
            className={`min-h-[38px] w-full rounded-xl border pr-3 pl-9 text-xs focus:outline-none ${
              isDark
                ? 'border-[#213E2C] bg-[#08130C] text-white placeholder:text-[#668070]'
                : 'border-[#DCD9CD] bg-[#FAF8F2] text-[#10281B] placeholder:text-[#788D81]'
            }`}
          />
        </div>
      </div>

      {/* History List + Detail */}
      {historicalTickets.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border p-10 text-center ${
            isDark ? 'border-[#193022] bg-[#0B1A11]' : 'border-[#E3E0D4] bg-white'
          }`}
        >
          <History
            className={`h-8 w-8 ${isDark ? 'text-[#5C7A68]' : 'text-[#7C9184]'}`}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold">No completed visits match this filter yet</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-[#89A594]' : 'text-[#546B5E]'}`}>
            Completed, missed, and cancelled tickets for {branch.branchName} appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div
            className={`overflow-hidden rounded-2xl border ${
              isDark ? 'border-[#193022] bg-[#0B1A11]' : 'border-[#E3E0D4] bg-white'
            }`}
          >
            <div className="divide-y divide-[#ECE9DE] dark:divide-[#172C1F]">
              {historicalTickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                const deskName = deskNameById.get(ticket.serviceId) || ticket.serviceId;
                const reason = reasonLookup(ticket);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                      isSelected
                        ? isDark
                          ? 'bg-[#132B1D]'
                          : 'bg-[#E2F4E9]/70'
                        : isDark
                        ? 'hover:bg-[#0F2116]'
                        : 'hover:bg-[#FAF8F2]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-tabular text-sm font-bold">
                          {ticket.ticketNumber}
                        </span>
                        <span className="truncate text-sm font-semibold">
                          {ticket.visitorName || 'Walk-in'}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                            isDark
                              ? 'bg-[#152D1E] text-[#9BB2A3]'
                              : 'bg-[#F0EDE3] text-[#4D5E52]'
                          }`}
                        >
                          {ticket.channel === 'walk-in' ? 'QR Walk-in' : 'Online'}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          isDark ? 'text-[#8CA697]' : 'text-[#546B5E]'
                        }`}
                      >
                        {deskName}
                        {reason ? ` · ${reason}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          ticket.status === 'completed'
                            ? isDark
                              ? 'bg-[#163D26] text-[#9CF0BD]'
                              : 'bg-[#E2F4E9] text-[#11482B]'
                            : ticket.status === 'deferred'
                            ? isDark
                              ? 'bg-[#3A2B12] text-[#FCD34D]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                            : isDark
                            ? 'bg-[#2C1616] text-[#FCA5A5]'
                            : 'bg-[#FEE2E2] text-[#991B1B]'
                        }`}
                      >
                        {ticket.status === 'deferred' ? 'Missed' : ticket.status}
                      </span>
                      <p
                        className={`font-mono-tabular mt-1 text-[11px] ${
                          isDark ? 'text-[#7F9A8A]' : 'text-[#5E7366]'
                        }`}
                      >
                        {formatTimestamp(ticket.completedAt ?? ticket.updatedAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail Card */}
          {selectedTicket && (
            <div
              className={`h-fit rounded-2xl border p-5 ${
                isDark ? 'border-[#193022] bg-[#0B1A11]' : 'border-[#E3E0D4] bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold ${isDark ? 'text-[#8CE2AE]' : 'text-[#18603B]'}`}>
                    {deskNameById.get(selectedTicket.serviceId) || selectedTicket.serviceId}
                  </p>
                  <h3 className="font-mono-tabular mt-1 text-2xl font-bold">
                    {selectedTicket.ticketNumber}
                  </h3>
                  <p className="mt-0.5 text-sm font-medium">
                    {selectedTicket.visitorName || 'Walk-in'}
                  </p>
                </div>
                <CheckCircle2
                  className={`h-5 w-5 ${isDark ? 'text-[#7CEBA4]' : 'text-[#18603B]'}`}
                  aria-hidden="true"
                />
              </div>

              <dl
                className={`mt-4 space-y-2.5 border-t pt-4 text-xs ${
                  isDark ? 'border-[#1A3122]' : 'border-[#EAE7DC]'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <dt className={isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}>Channel</dt>
                  <dd className="font-semibold">
                    {selectedTicket.channel === 'walk-in' ? 'QR Walk-in' : 'Online booking'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className={isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}>Counter</dt>
                  <dd className="font-semibold">{selectedTicket.counter || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className={isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}>Joined</dt>
                  <dd className="font-mono-tabular font-semibold">
                    {formatTimestamp(selectedTicket.createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className={isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}>Closed</dt>
                  <dd className="font-mono-tabular font-semibold">
                    {formatTimestamp(selectedTicket.completedAt ?? selectedTicket.updatedAt)}
                  </dd>
                </div>
                {reasonLookup(selectedTicket) && (
                  <div className="pt-1">
                    <dt className={isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}>Visit reason</dt>
                    <dd className="mt-1 font-medium">{reasonLookup(selectedTicket)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
