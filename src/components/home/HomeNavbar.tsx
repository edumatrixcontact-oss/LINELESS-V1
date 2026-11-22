import { useEffect, useState } from 'react';
import { Menu, Shield, User, X } from 'lucide-react';
import { ViewMode } from '../../types/queue';

interface HomeNavbarProps {
  onNavigate: (view: ViewMode) => void;
}

export function HomeNavbar({ onNavigate }: HomeNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setMobileOpen(false);
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateAndClose = (view: ViewMode) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-200 ${
        scrolled
          ? 'border-b border-[#182E20] bg-[#060E09]/92 backdrop-blur-md'
          : 'border-b border-white/5 bg-[#060E09]/80 backdrop-blur-xs'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-8">
        {/* Left: Green Icon Square + LINELESS */}
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7CEBA4]"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7CEBA4] text-[#072112] transition-transform duration-150 group-hover:scale-105"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="2.4" rx="1" fill="currentColor" />
                <rect x="2" y="6.8" width="8.5" height="2.4" rx="1" fill="currentColor" opacity="0.82" />
                <rect x="2" y="10.6" width="5" height="2.4" rx="1" fill="currentColor" opacity="0.58" />
              </svg>
            </span>
            <span className="font-display text-base font-bold tracking-[0.06em] text-[#F4F8F5]">
              LINELESS
            </span>
          </button>

          <nav aria-label="Homepage sections" className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-medium text-[#9CB3A4] transition-colors hover:text-[#F4F8F5]"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('two-ways')}
              className="text-sm font-medium text-[#9CB3A4] transition-colors hover:text-[#F4F8F5]"
            >
              Join flow
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('branch-qr')}
              className="text-sm font-medium text-[#9CB3A4] transition-colors hover:text-[#F4F8F5]"
            >
              Branch QR
            </button>
          </nav>
        </div>

        {/* Right: Clean Visitor & Staff Portal Access (no Live Display entry) */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigateAndClose('visitor-login')}
            className="hidden min-h-[38px] items-center gap-1.5 rounded-lg border border-[#233E2D] bg-[#0B1710] px-3.5 text-xs font-semibold text-[#E6F1EA] transition-colors hover:border-[#396248] hover:bg-[#112318] sm:inline-flex"
          >
            <User className="h-3.5 w-3.5 text-[#7CEBA4]" aria-hidden="true" />
            <span>Visitor sign in</span>
          </button>

          <button
            type="button"
            onClick={() => navigateAndClose('staff-login')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#7CEBA4] px-3.5 text-xs font-semibold text-[#082414] transition-colors hover:bg-[#93F2B5]"
          >
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Staff Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#233E2D] bg-[#0B1710] text-[#E6F1EA] md:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#182E20] bg-[#08130C] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="min-h-[42px] rounded-xl px-3 text-left text-sm font-medium text-[#C5D6CB] hover:bg-[#102217]"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('two-ways')}
              className="min-h-[42px] rounded-xl px-3 text-left text-sm font-medium text-[#C5D6CB] hover:bg-[#102217]"
            >
              Two ways to join
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('branch-qr')}
              className="min-h-[42px] rounded-xl px-3 text-left text-sm font-medium text-[#C5D6CB] hover:bg-[#102217]"
            >
              Try the branch QR
            </button>
            <div className="my-2 h-px bg-[#182E20]" />
            <button
              type="button"
              onClick={() => navigateAndClose('visitor-login')}
              className="min-h-[42px] rounded-xl border border-[#233E2D] bg-[#0B1710] px-4 text-left text-sm font-semibold text-[#F4F8F5]"
            >
              Visitor sign in
            </button>
            <button
              type="button"
              onClick={() => navigateAndClose('staff-login')}
              className="min-h-[42px] rounded-xl bg-[#7CEBA4] px-4 text-left text-sm font-semibold text-[#082414]"
            >
              Staff Portal
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
