import { ArrowLeft, LogIn, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeMode, ViewMode } from '../types/queue';

interface TopNavProps {
  view: ViewMode;
  onChangeView: (view: ViewMode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function TopNav({ view, onChangeView, theme, onToggleTheme }: TopNavProps) {
  const {
    user,
    isStaff,
    isDemoStaff,
    isDemoVisitor,
    logout,
    exitDemoStaffMode,
    exitDemoVisitorMode,
    authBusy,
  } = useAuth();
  const isStaffWorkspace = view === 'staff';
  const isVisitorWorkspace = view === 'visitor';

  const handleVisitorLogout = async () => {
    if (isDemoVisitor) {
      exitDemoVisitorMode();
      onChangeView('visitor-login');
      return;
    }
    if (user) {
      await logout();
      onChangeView('visitor-login');
    } else {
      onChangeView('visitor-login');
    }
  };

  const handleStaffLogout = async () => {
    if (isDemoStaff) {
      exitDemoStaffMode();
      onChangeView('staff-login');
      return;
    }
    if (isStaff && user) {
      await logout();
    }
    onChangeView('staff-login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#E3DFD6] bg-[#FAF8F2]/95 backdrop-blur-md dark:border-[#242924] dark:bg-[#0F120F]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:gap-6 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => onChangeView('home')}
            className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B4332] dark:focus-visible:outline-[#52B788]"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332] text-white transition-colors group-hover:bg-[#143627] dark:bg-[#2D6A4F] dark:group-hover:bg-[#3A8262]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="2.5" rx="1" fill="currentColor" />
                <rect x="2" y="7" width="8.5" height="2.5" rx="1" fill="currentColor" opacity="0.78" />
                <rect x="2" y="11" width="5" height="2.5" rx="1" fill="currentColor" opacity="0.55" />
              </svg>
            </span>
            <span className="font-display text-xl font-bold tracking-[0.06em] text-[#161A16] dark:text-[#F2F1EC]">
              LINELESS
            </span>
          </button>

          {(isStaffWorkspace || isVisitorWorkspace) && (
            <>
              <span
                aria-hidden="true"
                className="hidden h-5 w-px bg-[#DDD9CE] sm:inline-block dark:bg-[#272D27]"
              />
              <button
                type="button"
                onClick={() => onChangeView('home')}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-[#545954] transition-colors hover:bg-[#EFECE4] hover:text-[#161A16] sm:text-sm dark:text-[#9BA29B] dark:hover:bg-[#181D18] dark:hover:text-[#F2F1EC]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Homepage</span>
                <span className="sm:hidden">Homepage</span>
              </button>
            </>
          )}
        </div>

        {isStaffWorkspace ? (
          <nav aria-label="Staff operations navigation" className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden min-h-[38px] items-center rounded-lg bg-[#ECE9E0] px-3.5 text-sm font-semibold text-[#1B4332] sm:inline-flex dark:bg-[#1B221B] dark:text-[#95D5B2]">
              Staff Portal
            </span>
          </nav>
        ) : (
          <nav aria-label="Visitor navigation" className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden min-h-[38px] items-center rounded-lg bg-[#ECE9E0] px-3.5 text-sm font-semibold text-[#1B4332] sm:inline-flex dark:bg-[#1B221B] dark:text-[#95D5B2]">
              {isDemoVisitor ? 'Demo Visitor' : 'Visitor Dashboard'}
            </span>
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-[#DDD9CE] bg-white px-2.5 text-sm font-medium text-[#161A16] transition-colors duration-150 hover:bg-[#F2EFE8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#F2F1EC] dark:hover:bg-[#202520]"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-[#1B4332]" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 text-[#74C69D]" aria-hidden="true" />
            )}
          </button>

          {isStaffWorkspace ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleStaffLogout}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#DDD9CE] bg-white px-3.5 text-sm font-semibold text-[#2E332E] transition-colors duration-150 hover:bg-[#EFECE4] disabled:opacity-50 dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#D5DAD5] dark:hover:bg-[#202520]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{isDemoStaff ? 'Exit Demo' : 'Sign Out'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleVisitorLogout}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] ${
                user || isDemoVisitor
                  ? 'border border-[#DDD9CE] bg-white text-[#2E332E] hover:bg-[#EFECE4] dark:border-[#282E28] dark:bg-[#171B17] dark:text-[#D5DAD5] dark:hover:bg-[#202520]'
                  : 'bg-[#1B4332] text-white hover:bg-[#143627] dark:bg-[#2D6A4F] dark:hover:bg-[#3A8262]'
              }`}
            >
              {isDemoVisitor ? (
                <>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Exit Demo</span>
                </>
              ) : user ? (
                <>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
