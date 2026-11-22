import { ThemeMode, ViewMode } from '../../types/queue';
import { FinalCtaAndFooter } from './FinalCtaAndFooter';
import { HeroSection } from './HeroSection';
import { HomeNavbar } from './HomeNavbar';
import { LiveBranchQrSection } from './LiveBranchQrSection';
import { StaffPreviewSection } from './StaffPreviewSection';
import { TwoWaysToJoinSection } from './TwoWaysToJoinSection';
import { WatchDemoSection } from './WatchDemoSection';

interface HomePageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (view: ViewMode) => void;
  onWatchDemoQueue: () => void;
}

export function HomePage({ onNavigate, onWatchDemoQueue }: HomePageProps) {
  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#060E09] text-[#F4F8F5]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 68% 34% at 64% 7%, rgba(44, 134, 80, 0.22), transparent 72%), radial-gradient(ellipse 48% 32% at 14% 48%, rgba(31, 98, 59, 0.14), transparent 70%), radial-gradient(ellipse 52% 28% at 84% 78%, rgba(31, 98, 59, 0.12), transparent 72%)',
      }}
    >
      {/* Subtle Architectural Green Arcs Backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 2600"
        fill="none"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M-120 420 C 320 260, 760 540, 1560 300"
          stroke="#2E6B47"
          strokeOpacity="0.24"
          strokeWidth="1.2"
        />
        <path
          d="M-80 1120 C 420 940, 980 1280, 1540 1020"
          stroke="#2E6B47"
          strokeOpacity="0.18"
          strokeWidth="1.2"
        />
        <path
          d="M-100 1860 C 380 1660, 1020 1980, 1520 1760"
          stroke="#2E6B47"
          strokeOpacity="0.18"
          strokeWidth="1.2"
        />
      </svg>

      <div className="relative z-10">
        <HomeNavbar onNavigate={onNavigate} />

        <main>
          <HeroSection onNavigate={onNavigate} />
          <WatchDemoSection />
          <TwoWaysToJoinSection />
          <StaffPreviewSection onNavigate={onNavigate} />
          <LiveBranchQrSection
            onNavigate={onNavigate}
            onWatchDemoQueue={onWatchDemoQueue}
          />
        </main>

        <FinalCtaAndFooter onNavigate={onNavigate} />
      </div>
    </div>
  );
}
