import { useEffect, useState } from 'react';
import { ChevronRight, Landmark, Monitor, Pause, Play, Ticket, User } from 'lucide-react';

const WALKTHROUGH_STEPS = [
  {
    id: 0,
    label: '1 · Visitor asks Queue AI',
    visitorPrompt: 'Do I need to bring any documents to open a savings account?',
    aiReply:
      'Yes. Please bring a government ID (e.g., Aadhaar, PAN) and a proof of address.',
    activeTicket: 'B-105',
    activeMeta: 'Counter 2 · Now serving',
  },
  {
    id: 1,
    label: '2 · Joins Lalbagh branch queue',
    visitorPrompt: 'Join Account Opening at Lalbagh Branch',
    aiReply: 'Confirmed. Your digital ticket is B-106. Estimated wait is ~5 min.',
    activeTicket: 'B-106',
    activeMeta: 'Waiting · ~5 min',
  },
  {
    id: 2,
    label: '3 · Staff calls visitor to Counter 2',
    visitorPrompt: 'Desk notification sent',
    aiReply: 'Counter 2 is ready for you now.',
    activeTicket: 'B-106',
    activeMeta: 'Counter 2 · Called now',
  },
];

export function WatchDemoSection() {
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % WALKTHROUGH_STEPS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [playing]);

  const activeStep = WALKTHROUGH_STEPS[stepIndex];

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#F6FAF7] sm:text-4xl">
          See how LINELESS works
        </h2>
        <p className="mt-2.5 text-sm text-[#9CB3A4] sm:text-base">
          A quick walkthrough of the visitor chat and staff queue, from question to service.
        </p>
      </div>

      {/* 16:9 Interactive Glass Showcase */}
      <div className="relative mt-8 overflow-hidden rounded-3xl border border-[#233E2D] bg-gradient-to-b from-[#0E2015]/95 to-[#08130C]/95 p-4 shadow-2xl shadow-black/50 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7CEBA4]/30 to-transparent"
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Side: Visitor Chat View */}
          <div className="rounded-2xl border border-[#1E3627] bg-[#0A1810]/90 p-4 sm:p-5 lg:col-span-6">
            <div className="flex items-center gap-2 border-b border-[#1B3123] pb-3">
              <Landmark className="h-4 w-4 text-[#D0E2D7]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#F4F8F5]">Lalbagh Branch</span>
            </div>

            <div className="my-3.5 flex justify-center">
              <div className="inline-flex rounded-xl border border-[#233E2D] bg-[#07120C] p-0.5 text-[11px] font-semibold">
                <span className="rounded-lg bg-[#8CF0B1] px-4 py-1 text-[#082414]">Queue AI</span>
                <span className="px-4 py-1 text-[#9CB3A4]">Desk Chat</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-xs border border-[#2A4936] bg-[#16291D] px-3.5 py-2.5 text-xs leading-relaxed text-[#EDF5EF] sm:text-sm">
                {activeStep.visitorPrompt}
              </div>

              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2A4936] bg-[#122318] text-[#7CEBA4]">
                  <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-[#CFE2D6]">Queue AI</p>
                  <div className="rounded-2xl rounded-tl-xs border border-[#254030] bg-[#122218] px-3.5 py-2.5 text-xs leading-relaxed text-[#E4EFE8] sm:text-sm">
                    {activeStep.aiReply}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2A4B37] bg-[#112418] px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Ticket className="h-4 w-4 shrink-0 text-[#7CEBA4]" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#F4F8F5]">Join the queue?</p>
                    <p className="text-[11px] text-[#9CB3A4]">Next: B-105 · Counter 2</p>
                  </div>
                </div>
                <span className="rounded-lg bg-[#8CE6AE] px-3 py-1.5 text-xs font-bold text-[#082414]">
                  Join queue
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Staff Queue View */}
          <div className="rounded-2xl border border-[#1E3627] bg-[#0A1810]/90 p-4 sm:p-5 lg:col-span-6">
            <div className="flex items-center gap-2 border-b border-[#1B3123] pb-3">
              <Monitor className="h-4 w-4 text-[#CFE2D6]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#F4F8F5]">
                Staff Queue — Lalbagh Branch
              </span>
            </div>

            <div className="my-3.5 grid grid-cols-3 rounded-xl border border-[#233E2D] bg-[#07120C] p-0.5 text-center text-[11px] font-semibold">
              <span className="rounded-lg bg-[#8CF0B1] py-1 text-[#082414]">Live Queue</span>
              <span className="py-1 text-[#9CB3A4]">Served</span>
              <span className="py-1 text-[#9CB3A4]">All</span>
            </div>

            <div className="space-y-2.5">
              {[
                { num: 'B-105', desc: 'Counter 2 · Now serving', highlight: stepIndex === 0 },
                {
                  num: 'B-106',
                  desc: stepIndex === 2 ? 'Counter 2 · Called now' : 'Waiting · ~5 min',
                  highlight: stepIndex > 0,
                },
                { num: 'B-107', desc: 'Waiting · ~10 min', highlight: false },
              ].map((row) => (
                <div
                  key={row.num}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors ${
                    row.highlight
                      ? 'border-[#7CEBA4]/50 bg-[#1B3E2A]'
                      : 'border-[#213B2B] bg-[#0F2016]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#2C4B38] bg-[#13261B] text-[#CFE2D6]">
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-mono-tabular text-sm font-bold text-[#F6FAF7]">{row.num}</p>
                      <p className="text-[11px] text-[#B7CABF]">{row.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#85A391]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Watch Workflow Button Overlay (Desktop centered / Mobile below) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1A3023] pt-4 lg:mt-5">
          <div className="flex flex-wrap items-center gap-2">
            {WALKTHROUGH_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setStepIndex(idx);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  stepIndex === idx
                    ? 'bg-[#1D402B] text-[#8CE6AE]'
                    : 'text-[#8CA897] hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[#2D503A] bg-[#102418] px-4 text-xs font-semibold text-[#F4F8F5] transition-colors hover:border-[#7CEBA4]/60 hover:bg-[#173322]"
          >
            {playing ? (
              <>
                <Pause className="h-3.5 w-3.5 text-[#7CEBA4]" aria-hidden="true" />
                <span>Pause workflow</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current text-[#7CEBA4]" aria-hidden="true" />
                <span>Watch workflow</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
