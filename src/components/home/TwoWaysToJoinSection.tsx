import { Calendar, Landmark, Laptop, ScanLine } from 'lucide-react';

export function TwoWaysToJoinSection() {
  return (
    <section id="two-ways" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#F6FAF7] sm:text-4xl">
          Two ways to join
        </h2>
        <p className="mt-2.5 text-sm text-[#9CB3A4] sm:text-base">
          Take a spot in the branch queue from anywhere, or scan the branch QR when you&apos;re there.
        </p>
      </div>

      {/* Two Side-by-Side Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Card 1: Book Online */}
        <div className="rounded-3xl border border-[#233E2D] bg-gradient-to-b from-[#0E2015]/95 to-[#08130C]/95 p-5 shadow-xl shadow-black/40 sm:p-6">
          <div className="flex items-start gap-3">
            <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-[#D0E2D7]" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-semibold text-[#F6FAF7]">Book online</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#9CB3A4] sm:text-sm">
                Ask Queue AI, get what you need, and book your visit in seconds.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#1E3627] bg-[#0A170F] p-4">
            <div className="mb-3 border-b border-[#192E21] pb-2 text-center text-xs font-semibold text-[#D6E6DC]">
              Queue AI
            </div>

            <div className="space-y-2.5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-xs border border-[#2A4936] bg-[#16291D] px-3 py-2 text-xs text-[#EDF5EF]">
                I&apos;d like to visit the branch to open an account.
              </div>

              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#2A4936] bg-[#122318] text-[#7CEBA4]">
                  <Landmark className="h-3 w-3" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-[#CFE2D6]">Queue AI</p>
                  <div className="rounded-2xl rounded-tl-xs border border-[#254030] bg-[#122218] px-3 py-2 text-xs text-[#E4EFE8]">
                    Sure. Here&apos;s a booking for Lalbagh Branch.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2A4B37] bg-[#102217] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-[#7CEBA4]" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#F4F8F5]">Confirm booking</p>
                    <p className="text-[11px] text-[#9CB3A4]">
                      Lalbagh Branch · Account opening
                    </p>
                  </div>
                </div>
                <span className="rounded-lg bg-[#8CE6AE] px-2.5 py-1 text-[11px] font-bold text-[#082414]">
                  Confirm booking
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Scan at the Branch */}
        <div className="rounded-3xl border border-[#233E2D] bg-gradient-to-b from-[#0E2015]/95 to-[#08130C]/95 p-5 shadow-xl shadow-black/40 sm:p-6">
          <div className="flex items-start gap-3">
            <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-[#D0E2D7]" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-semibold text-[#F6FAF7]">
                Scan at the branch
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#9CB3A4] sm:text-sm">
                Use the branch QR to join the same live queue on your phone.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="w-full max-w-[270px] rounded-2xl border-2 border-[#274331] bg-[#08130D] p-4 shadow-lg">
              <div className="flex items-center justify-between text-[10px] font-semibold text-[#9CB3A4]">
                <span>10:24</span>
                <span>••• 5G</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#F4F8F5]">
                <Landmark className="h-4 w-4 text-[#CFE2D6]" aria-hidden="true" />
                <span>Lalbagh Branch</span>
              </div>

              <div className="mt-3 rounded-lg bg-[#8CE6AE] py-2 text-center text-xs font-bold text-[#082414]">
                Join queue
              </div>

              <div className="mt-3 rounded-xl border border-[#233E2D] bg-[#0F2016] px-3 py-3 text-center">
                <p className="text-[11px] text-[#9CB3A4]">Your ticket</p>
                <p className="font-mono-tabular mt-0.5 text-2xl font-bold text-[#F6FAF7]">
                  B-106
                </p>
                <p className="mt-0.5 text-[11px] text-[#9CB3A4]">
                  Counter 2 · Est. wait ~5 min
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Converging Shared Queue Diagram */}
      <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-4 md:flex-row md:justify-center md:gap-0">
        <div className="flex w-full max-w-[220px] flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#233E2D] bg-[#0B1810] px-4 py-2.5 text-sm font-medium text-[#E4EFE8]">
            <Laptop className="h-4 w-4 text-[#9CB3A4]" aria-hidden="true" />
            <span>Online</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-[#233E2D] bg-[#0B1810] px-4 py-2.5 text-sm font-medium text-[#E4EFE8]">
            <ScanLine className="h-4 w-4 text-[#9CB3A4]" aria-hidden="true" />
            <span>Walk-in</span>
          </div>
        </div>

        {/* Crisp SVG Converging Connector */}
        <svg
          aria-hidden="true"
          viewBox="0 0 110 72"
          className="hidden h-[72px] w-[110px] shrink-0 md:block"
          fill="none"
        >
          <path
            d="M0 16 H48 C56 16, 56 36, 66 36 H104"
            stroke="#5EA67B"
            strokeWidth="1.8"
          />
          <path
            d="M0 56 H48 C56 56, 56 36, 66 36 H104"
            stroke="#5EA67B"
            strokeWidth="1.8"
          />
          <path
            d="M98 31 L106 36 L98 41"
            stroke="#5EA67B"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex w-full max-w-sm items-center gap-3 rounded-xl bg-[#8CE6AE] px-5 py-3.5 text-[#082414] shadow-lg shadow-emerald-950/30">
          <Landmark className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold leading-tight">Branch queue</p>
            <p className="text-xs font-medium text-[#0B351D]">
              One shared, real-time queue for the branch
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
