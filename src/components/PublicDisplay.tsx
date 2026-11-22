import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Megaphone, Moon, PauseCircle, Sun } from 'lucide-react';
import { useQueue } from '../context/QueueContext';
import { ThemeMode } from '../types/queue';

interface PublicDisplayProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onExitDisplay: () => void;
}

export function PublicDisplay({ theme, onToggleTheme, onExitDisplay }: PublicDisplayProps) {
  const { services, queueFeed, announcements: allAnnouncements, getServiceById, loadingQueue } =
    useQueue();
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const filteredFeed = useMemo(() => {
    if (selectedServiceId === 'all') return queueFeed;
    return queueFeed.filter((item) => item.serviceId === selectedServiceId);
  }, [queueFeed, selectedServiceId]);

  const nowServing = useMemo(
    () =>
      filteredFeed
        .filter((item) => item.status === 'called' || item.status === 'serving')
        .sort((a, b) => {
          if (a.status === 'called' && b.status !== 'called') return -1;
          if (b.status === 'called' && a.status !== 'called') return 1;
          return (b.calledAt ?? b.createdAt) - (a.calledAt ?? a.createdAt);
        }),
    [filteredFeed]
  );

  const upNext = useMemo(
    () =>
      filteredFeed
        .filter((item) => item.status === 'waiting')
        .sort((a, b) => a.queueOrderAt - b.queueOrderAt)
        .slice(0, 5),
    [filteredFeed]
  );

  const recentlyServed = useMemo(
    () =>
      filteredFeed
        .filter((item) => item.status === 'completed')
        .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
        .slice(0, 5),
    [filteredFeed]
  );

  const announcements = useMemo(
    () =>
      allAnnouncements.filter(
        (a) =>
          selectedServiceId === 'all' ||
          a.serviceId === 'all' ||
          a.serviceId === selectedServiceId
      ),
    [allAnnouncements, selectedServiceId]
  );

  const selectedService =
    selectedServiceId === 'all' ? null : getServiceById(selectedServiceId);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F0] text-[#161A16] dark:bg-[#0B0E0B] dark:text-[#F4F3EE]">
      {/* Dedicated TV Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3DFD6] bg-white px-6 py-4 sm:px-10 sm:py-5 dark:border-[#202620] dark:bg-[#111511]">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B4332] text-white dark:bg-[#2D6A4F]"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="2.5" rx="1" fill="currentColor" />
                <rect x="2" y="7" width="8.5" height="2.5" rx="1" fill="currentColor" opacity="0.78" />
                <rect x="2" y="11" width="5" height="2.5" rx="1" fill="currentColor" opacity="0.55" />
              </svg>
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-[#161A16] dark:text-[#F4F3EE]">
              LINELESS
            </span>
          </div>

          <span className="hidden h-5 w-px bg-[#DCD7CC] sm:inline-block dark:bg-[#272D27]" />

          <span className="hidden text-base font-medium text-[#4E544E] sm:inline dark:text-[#A5ACA5]">
            {selectedService
              ? `${selectedService.facility} · ${selectedService.name}`
              : 'All Bank Desks'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            aria-label="Filter bank desk"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#D8D4CA] bg-[#FAF9F6] px-3.5 text-sm font-medium text-[#161A16] dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#F2F1EC]"
          >
            <option value="all">All Desks</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <span className="font-mono-tabular hidden px-3 text-xl font-bold text-[#161A16] md:inline dark:text-[#F4F3EE]">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light' ? 'Switch display to dark mode' : 'Switch display to light mode'
            }
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#D8D4CA] bg-[#FAF9F6] text-[#161A16] hover:bg-[#EFECE4] dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#F2F1EC] dark:hover:bg-[#222622]"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onExitDisplay}
            className="inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-xl border border-[#D8D4CA] bg-[#FAF9F6] px-4 text-sm font-semibold text-[#2E332E] hover:bg-[#EFECE4] dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#D5DAD5] dark:hover:bg-[#222622]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Exit Display</span>
          </button>
        </div>
      </header>

      {/* Paused Status Strip */}
      {selectedService?.isPaused && (
        <div className="flex items-center justify-center gap-3 bg-[#FEF3C7] px-6 py-3.5 text-lg font-semibold text-[#92400E] dark:bg-[#451A03] dark:text-[#FDE68A]">
          <PauseCircle className="h-6 w-6" aria-hidden="true" />
          <span>{selectedService.name} queue is temporarily paused</span>
        </div>
      )}

      {/* Broadcast Announcement Strip */}
      {announcements.length > 0 && (
        <div className="flex items-center justify-center gap-3 bg-[#0F766E] px-6 py-4 text-center text-lg font-semibold text-white sm:text-xl dark:bg-[#115E59]">
          <Megaphone className="h-6 w-6 shrink-0 text-[#CCFBF1]" aria-hidden="true" />
          <span>{announcements[0].message}</span>
        </div>
      )}

      {/* Main High-Contrast TV Split Layout */}
      <main className="grid flex-1 grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:gap-10">
        {/* Dominant Left 65%: NOW CALLING & SERVING */}
        <section aria-label="Now calling and serving" className="flex flex-col lg:col-span-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#DCD7CC] pb-3.5 dark:border-[#232923]">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[#1B4332] sm:text-4xl dark:text-[#74C69D]">
              Now Serving
            </h1>
            <span className="text-base font-medium text-[#545954] dark:text-[#9BA29B]">
              Watch for your ticket number and proceed to the counter
            </span>
          </div>

          {loadingQueue ? (
            <div className="surface-elevated flex flex-1 items-center justify-center rounded-3xl border border-[#E3DFD6] bg-white p-14 text-center dark:border-[#202620] dark:bg-[#131713]">
              <p className="font-display text-2xl font-medium text-[#545954] dark:text-[#9BA29B]">
                Connecting to live queue board...
              </p>
            </div>
          ) : nowServing.length === 0 ? (
            <div className="surface-elevated flex flex-1 items-center justify-center rounded-3xl border border-[#E3DFD6] bg-white p-14 text-center dark:border-[#202620] dark:bg-[#131713]">
              <p className="font-display text-3xl font-medium text-[#545954] dark:text-[#9BA29B]">
                Waiting for the next visitor to be called
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {nowServing.map((item) => {
                const svc = getServiceById(item.serviceId);
                const isCalled = item.status === 'called';
                return (
                  <div
                    key={item.id}
                    className={`surface-elevated flex flex-col justify-between gap-6 rounded-3xl border p-7 sm:flex-row sm:items-center sm:px-10 sm:py-8 ${
                      isCalled
                        ? 'border-[#1B4332] bg-[#1B4332] text-white dark:border-[#52B788] dark:bg-[#1A3F2D] dark:text-[#F4F3EE]'
                        : 'border-[#E3DFD6] bg-white text-[#161A16] dark:border-[#232923] dark:bg-[#141814] dark:text-[#F4F3EE]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <p
                        className={`text-sm font-bold uppercase tracking-wider sm:text-base ${
                          isCalled
                            ? 'text-[#B7E4C7]'
                            : 'text-[#0F766E] dark:text-[#5EEAD4]'
                        }`}
                      >
                        {isCalled ? 'Please Proceed Now' : 'Currently Serving'} · {svc?.name}
                      </p>
                      <p className="font-mono-tabular text-6xl leading-none font-bold tracking-tight sm:text-8xl">
                        {item.ticketNumber}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl px-6 py-4 sm:min-w-[230px] sm:text-right ${
                        isCalled
                          ? 'bg-white/12'
                          : 'bg-[#F7F5F0] dark:bg-[#1C211C]'
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wider ${
                          isCalled ? 'text-[#D8F3DC]' : 'text-[#545954] dark:text-[#9BA29B]'
                        }`}
                      >
                        Counter
                      </p>
                      <p className="font-display mt-1 text-3xl font-bold sm:text-5xl">
                        {item.counter ?? 'Desk'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 35%: UP NEXT & RECENTLY SERVED */}
        <aside className="flex flex-col gap-8 lg:col-span-4">
          {/* Up Next */}
          <section aria-label="Up next">
            <h2 className="font-display mb-4 border-b border-[#DCD7CC] pb-3.5 text-2xl font-semibold text-[#161A16] dark:border-[#232923] dark:text-[#F4F3EE]">
              Up Next
            </h2>
            {upNext.length === 0 ? (
              <div className="rounded-2xl border border-[#E3DFD6] bg-white px-6 py-8 text-center text-base text-[#545954] dark:border-[#202620] dark:bg-[#131713] dark:text-[#9BA29B]">
                No visitors currently waiting.
              </div>
            ) : (
              <div className="surface-elevated divide-y divide-[#ECE9E0] rounded-2xl border border-[#E3DFD6] bg-white dark:divide-[#202620] dark:border-[#202620] dark:bg-[#131713]">
                {upNext.map((item, idx) => {
                  const svc = getServiceById(item.serviceId);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono-tabular text-base font-semibold text-[#5E635E] dark:text-[#8F968F]">
                          {idx + 1}
                        </span>
                        <span className="font-mono-tabular text-3xl font-bold text-[#161A16] dark:text-[#F4F3EE]">
                          {item.ticketNumber}
                        </span>
                      </div>
                      <span className="truncate text-base font-medium text-[#4E544E] dark:text-[#A5ACA5]">
                        {svc?.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recently Served */}
          <section aria-label="Recently served">
            <h2 className="font-display mb-4 border-b border-[#DCD7CC] pb-3.5 text-2xl font-semibold text-[#4E544E] dark:border-[#232923] dark:text-[#A5ACA5]">
              Recently Served
            </h2>
            {recentlyServed.length === 0 ? (
              <div className="rounded-2xl border border-[#E3DFD6] bg-[#EFECE4] px-6 py-6 text-center text-base text-[#545954] dark:border-[#202620] dark:bg-[#111511] dark:text-[#9BA29B]">
                No completed tickets yet.
              </div>
            ) : (
              <div className="divide-y divide-[#E3DFD6] rounded-2xl border border-[#E3DFD6] bg-[#EFECE4]/70 dark:divide-[#202620] dark:border-[#202620] dark:bg-[#111511]">
                {recentlyServed.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-6 py-3.5"
                  >
                    <span className="font-mono-tabular text-2xl font-bold text-[#2E332E] dark:text-[#D5DAD5]">
                      {item.ticketNumber}
                    </span>
                    <span className="text-base font-medium text-[#545954] dark:text-[#9BA29B]">
                      {item.counter ?? 'Completed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
