import { useState } from 'react';
import { ArrowRight, Bell, Landmark } from 'lucide-react';
import { ViewMode } from '../../types/queue';

interface HeroSectionProps {
  onNavigate: (view: ViewMode) => void;
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  const [previewTab, setPreviewTab] = useState<'queue-ai' | 'desk-chat'>('desk-chat');

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
        {/* Left: Bank Headline & Strictly Two Entry CTAs */}
        <div className="space-y-6 lg:col-span-5">
          <h1 className="font-display text-4xl leading-[1.06] font-bold tracking-tight text-[#F6FAF7] sm:text-5xl lg:text-[3.35rem]">
            Your bank visit starts with a{' '}
            <span className="text-[#7CEBA4]">conversation.</span>
          </h1>

          <p className="max-w-md text-base leading-relaxed text-[#9CB3A4] sm:text-lg">
            Find out what to bring, join your branch’s queue, and hear from the bank desk when it’s your turn.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('visitor-login')}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#8CF0B1] px-6 text-sm font-semibold text-[#082414] shadow-lg shadow-emerald-950/40 transition-colors hover:bg-[#9EF4BE]"
            >
              <span>Visitor sign in</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('staff-login')}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-[#2A4936] bg-[#0B1710]/80 px-6 text-sm font-semibold text-[#EDF5EF] transition-colors hover:border-[#3F6B50] hover:bg-[#102217]"
            >
              Staff sign in
            </button>
          </div>
        </div>

        {/* Right: Lalbagh Branch Conversation + Live Queue Glass Mockup */}
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl border border-[#233E2D] bg-gradient-to-br from-[#0F2116]/95 via-[#0B1810]/95 to-[#08120C]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-6">
            {/* Subtle top glass highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7CEBA4]/35 to-transparent"
            />

            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-[#1D3426] pb-3.5">
              <Landmark className="h-5 w-5 text-[#CFE3D6]" aria-hidden="true" />
              <span className="font-display text-base font-semibold text-[#F4F8F5]">
                Lalbagh Branch
              </span>
            </div>

            {/* Segmented Pill Toggle */}
            <div className="my-4 flex justify-center">
              <div className="inline-flex rounded-xl border border-[#233E2D] bg-[#08130D] p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('queue-ai')}
                  className={`min-h-[30px] rounded-lg px-5 text-xs font-semibold transition-colors ${
                    previewTab === 'queue-ai'
                      ? 'bg-[#8CF0B1] text-[#082414]'
                      : 'text-[#AFC4B7] hover:text-white'
                  }`}
                >
                  Queue AI
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('desk-chat')}
                  className={`min-h-[30px] rounded-lg px-5 text-xs font-semibold transition-colors ${
                    previewTab === 'desk-chat'
                      ? 'bg-[#8CF0B1] text-[#082414]'
                      : 'text-[#AFC4B7] hover:text-white'
                  }`}
                >
                  Desk Chat
                </button>
              </div>
            </div>

            {/* Split Glass Body: Conversation Left + Live Queue Right */}
            <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#1E3627] bg-[#09160F]/85 sm:grid-cols-12">
              {/* Conversation Pane */}
              <div className="flex flex-col justify-between gap-4 border-b border-[#1E3627] p-4 sm:col-span-8 sm:border-r sm:border-b-0 sm:p-5">
                {previewTab === 'desk-chat' ? (
                  <div className="space-y-4">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-xs border border-[#2C4B38] bg-[#182C20] px-4 py-2.5 text-sm text-[#EDF5EF]">
                      What should I bring to open an account?
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2B4837] bg-[#13261B] text-[#CFE3D6]">
                        <Landmark className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-[#D6E6DC]">Bank desk</p>
                        <div className="rounded-2xl rounded-tl-xs border border-[#264131] bg-[#132319] px-4 py-2.5 text-sm text-[#E4EFE8]">
                          I&apos;ll share the document checklist here.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-xs border border-[#2C4B38] bg-[#182C20] px-4 py-2.5 text-sm text-[#EDF5EF]">
                      How long is Customer Service wait right now?
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2B4837] bg-[#13261B] text-[#7CEBA4]">
                        <Landmark className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-[#7CEBA4]">Queue AI</p>
                        <div className="rounded-2xl rounded-tl-xs border border-[#264131] bg-[#132319] px-4 py-2.5 text-sm text-[#E4EFE8]">
                          Customer Service is open. Estimated wait is ~6 min with 2 people waiting.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Your Turn Banner */}
                <div className="flex items-center gap-3 rounded-xl bg-[#8CE6AE] px-4 py-3 text-[#082414]">
                  <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold leading-tight">Your turn</p>
                    <p className="text-xs font-medium text-[#0B351D]">B-105 · Counter 2</p>
                  </div>
                </div>
              </div>

              {/* Live Queue Column */}
              <div className="flex flex-col justify-between bg-[#08130D]/70 p-4 sm:col-span-4 sm:p-5">
                <div>
                  <p className="border-b border-[#1E3627] pb-2.5 text-sm font-semibold text-[#F4F8F5]">
                    Live Queue
                  </p>
                  <div className="mt-3 border-b border-[#1A2F22] pb-3.5">
                    <p className="text-xs text-[#9CB3A4]">Now serving</p>
                    <p className="font-mono-tabular mt-1 text-3xl font-bold tracking-tight text-[#F6FAF7]">
                      B-105
                    </p>
                    <p className="text-xs text-[#D0E0D6]">Counter 2</p>
                    <span className="mt-2 inline-flex rounded-full bg-[#8CE6AE] px-3 py-0.5 text-[11px] font-bold text-[#082414]">
                      You
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-[#9CB3A4]">Up next</p>
                  <div className="font-mono-tabular mt-1.5 divide-y divide-[#1A2F22] text-sm font-semibold text-[#F4F8F5]">
                    <p className="py-1.5">B-106</p>
                    <p className="pt-1.5">B-107</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
