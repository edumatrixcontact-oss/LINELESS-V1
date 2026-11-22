import { ViewMode } from '../../types/queue';
import { LinelessMark } from './LinelessMark';

interface FinalCtaAndFooterProps {
  onNavigate: (view: ViewMode) => void;
}

export function FinalCtaAndFooter({ onNavigate }: FinalCtaAndFooterProps) {
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="border-t border-[#182E20] py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-4 sm:flex-row sm:items-center sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <LinelessMark size={20} className="text-[#7CEBA4]" />
            <span className="font-display text-sm font-bold tracking-[0.06em] text-[#F4F8F5]">
              LINELESS
            </span>
          </div>
          <span aria-hidden="true" className="hidden h-4 w-px bg-[#203929] sm:inline-block" />
          <p className="text-xs text-[#9CB3A4]">Bank branch queues &amp; desk messaging.</p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#9CB3A4]"
        >
          <button
            type="button"
            onClick={() => scrollToSection('how-it-works')}
            className="transition-colors hover:text-[#F4F8F5]"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('branch-qr')}
            className="transition-colors hover:text-[#F4F8F5]"
          >
            Branch QR
          </button>
          <button
            type="button"
            onClick={() => onNavigate('visitor-login')}
            className="transition-colors hover:text-[#F4F8F5]"
          >
            Visitor sign in
          </button>
          <button
            type="button"
            onClick={() => onNavigate('staff-login')}
            className="font-semibold text-[#7CEBA4] transition-colors hover:underline"
          >
            Staff Portal
          </button>
        </nav>
      </div>
    </footer>
  );
}
