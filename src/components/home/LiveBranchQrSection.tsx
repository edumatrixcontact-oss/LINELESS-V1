import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import QRCode from 'qrcode';
import { DEMO_BRANCH_ID, DEMO_DESK_ID } from '../../data/bankCatalog';
import { ViewMode } from '../../types/queue';

interface LiveBranchQrSectionProps {
  onNavigate: (view: ViewMode) => void;
  onWatchDemoQueue: () => void;
}

export function LiveBranchQrSection({
  onNavigate,
  onWatchDemoQueue,
}: LiveBranchQrSectionProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const qrTargetUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/#qr?branch=${encodeURIComponent(
          DEMO_BRANCH_ID
        )}&desk=${encodeURIComponent(DEMO_DESK_ID)}`
      : `/#qr?branch=${DEMO_BRANCH_ID}&desk=${DEMO_DESK_ID}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrTargetUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#08170F',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        // Ignore generation failure
      });
    return () => {
      active = false;
    };
  }, [qrTargetUrl]);

  return (
    <section id="branch-qr" className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pb-24">
      <div className="rounded-3xl border border-[#233E2D] bg-gradient-to-br from-[#0F2317]/95 via-[#0B1A11]/95 to-[#09150E]/95 p-6 shadow-2xl shadow-black/50 sm:p-10">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Left: Real Scannable QR Code + Device Shortcut */}
          <div className="flex flex-col items-center text-center lg:col-span-5">
            <div className="rounded-2xl bg-white p-3.5 shadow-xl shadow-black/35">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan QR to join Lalbagh Demo Branch Customer Service queue"
                  className="h-44 w-44 sm:h-48 sm:w-48"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center bg-white text-xs text-[#4D6357] sm:h-48 sm:w-48">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="mt-3 text-xs font-medium text-[#CFE2D6]">
              Lalbagh Demo Branch · Customer Service
            </p>
            <button
              type="button"
              onClick={() => onNavigate('qr')}
              className="mt-1.5 inline-flex items-center gap-1.5 border-b border-[#7CEBA4]/50 pb-0.5 text-xs font-semibold text-[#F4F8F5] transition-colors hover:border-[#7CEBA4] hover:text-[#7CEBA4]"
            >
              <span>Open on this device</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Right: 3-Step Guide + Live Queue Button */}
          <div className="space-y-5 lg:col-span-7">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-[#F6FAF7] sm:text-4xl">
                Try the branch QR
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#B2C6BA]">
                Each branch gets its own entrance QR. Scan this one to try the Lalbagh branch flow.
              </p>
            </div>

            <ol className="space-y-2.5 text-sm text-[#DCEAE1]">
              <li className="flex items-center gap-3">
                <span className="font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1C3B28] text-xs font-bold text-[#8CE6AE]">
                  1
                </span>
                <span>Open the live queue.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1C3B28] text-xs font-bold text-[#8CE6AE]">
                  2
                </span>
                <span>Scan the code.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1C3B28] text-xs font-bold text-[#8CE6AE]">
                  3
                </span>
                <span>
                  Tap <strong className="font-semibold text-white">Join queue</strong> and watch your ticket appear.
                </span>
              </li>
            </ol>

            <div className="pt-1">
              <button
                type="button"
                onClick={onWatchDemoQueue}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#8CF0B1] px-6 text-sm font-semibold text-[#082414] transition-colors hover:bg-[#9EF4BE]"
              >
                <span>Watch the live queue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
