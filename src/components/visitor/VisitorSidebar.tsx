import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  Ticket as TicketIcon,
  User as UserIcon,
  X,
} from 'lucide-react';
import { VisitorNavTab, VisitorThemeMode } from './types';

interface VisitorSidebarProps {
  activeTab: VisitorNavTab;
  onSelectTab: (tab: VisitorNavTab) => void;
  onBackToHomepage: () => void;
  onSignOut: () => void;
  displayName: string;
  displaySubtitle: string;
  avatarUrl?: string | null;
  isDemoVisitor: boolean;
  activeTicketCount: number;
  unreadChatCount: number;
  visitorTheme: VisitorThemeMode;
  onToggleVisitorTheme: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function VisitorSidebar({
  activeTab,
  onSelectTab,
  onBackToHomepage,
  onSignOut,
  displayName,
  displaySubtitle,
  avatarUrl,
  isDemoVisitor,
  activeTicketCount,
  unreadChatCount,
  visitorTheme,
  onToggleVisitorTheme,
  mobileOpen,
  onCloseMobile,
}: VisitorSidebarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isDark = visitorTheme === 'dark';

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [accountMenuOpen]);

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'V';

  const handleNavClick = (tab: VisitorNavTab) => {
    onSelectTab(tab);
    setAccountMenuOpen(false);
    onCloseMobile();
  };

  const renderAvatar = (sizeClass: string) =>
    avatarUrl ? (
      <img
        src={avatarUrl}
        alt={`${displayName} profile`}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${
          isDark ? 'border border-[#2A4E37]' : 'border border-[#CFE0D4]'
        }`}
      />
    ) : (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isDark ? 'bg-[#1D5A36] text-[#DCF5E5]' : 'bg-[#1B4332] text-[#F5FAF6]'
        }`}
      >
        {initials}
      </div>
    );

  const sidebarSurface = isDark
    ? 'bg-[#08130C] text-[#F1F6F2] border-[#172B1E]'
    : 'bg-[#F5F3EC] text-[#11281B] border-[#E3DFD3]';

  const renderBody = (isMobileDrawer: boolean) => (
    <div className={`flex h-full flex-col justify-between ${sidebarSurface}`}>
      <div>
        {/* Brand Header */}
        <div
          className={`flex h-16 items-center justify-between px-4 ${
            isDark ? 'border-b border-[#16281D]' : 'border-b border-[#E5E2D6]'
          }`}
        >
          <button
            type="button"
            onClick={onBackToHomepage}
            title="Back to LINELESS Homepage"
            className="flex min-w-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
          >
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isDark ? 'bg-[#2EA45F] text-white' : 'bg-[#1B4332] text-white'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="2.5" rx="1" fill="currentColor" />
                <rect x="2" y="7" width="8.5" height="2.5" rx="1" fill="currentColor" opacity="0.82" />
                <rect x="2" y="11" width="5" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
            </span>
            <span
              className={`font-display truncate text-base font-bold tracking-[0.06em] ${
                isDark ? 'text-white' : 'text-[#11281B]'
              }`}
            >
              LINELESS
            </span>
          </button>

          {isMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isDark
                  ? 'text-[#9BB2A3] hover:bg-[#13251A]'
                  : 'text-[#4B6356] hover:bg-[#EAE7DC]'
              }`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Simple Two-Item Primary Navigation */}
        <nav aria-label="Visitor dashboard navigation" className="space-y-1.5 px-3 py-4">
          <button
            type="button"
            onClick={() => handleNavClick('conversations')}
            aria-current={activeTab === 'conversations' ? 'page' : undefined}
            className={`relative flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'conversations'
                ? isDark
                  ? 'border border-[#348F59]/65 bg-[#164228] text-white'
                  : 'border border-[#A7D8B9] bg-[#E2F4E9] text-[#103823]'
                : isDark
                ? 'border border-transparent text-[#9FB4A6] hover:bg-[#102016] hover:text-white'
                : 'border border-transparent text-[#3B5245] hover:bg-[#ECE9DF] hover:text-[#11281B]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <MessageSquare className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate">Conversations</span>
            </span>
            {unreadChatCount > 0 && (
              <span
                aria-label="Unread desk messages"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isDark ? 'bg-[#5CE092]' : 'bg-[#1D7A48]'
                }`}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('tickets')}
            aria-current={activeTab === 'tickets' ? 'page' : undefined}
            className={`relative flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'tickets'
                ? isDark
                  ? 'border border-[#348F59]/65 bg-[#164228] text-white'
                  : 'border border-[#A7D8B9] bg-[#E2F4E9] text-[#103823]'
                : isDark
                ? 'border border-transparent text-[#9FB4A6] hover:bg-[#102016] hover:text-white'
                : 'border border-transparent text-[#3B5245] hover:bg-[#ECE9DF] hover:text-[#11281B]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <TicketIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate">My Tickets</span>
            </span>
            {activeTicketCount > 0 && (
              <span
                className={`font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  activeTab === 'tickets'
                    ? isDark
                      ? 'bg-white/20 text-white'
                      : 'bg-[#1B4332] text-white'
                    : isDark
                    ? 'bg-[#152D1E] text-[#8CE2AE]'
                    : 'bg-[#E1ECE5] text-[#1B4332]'
                }`}
              >
                {activeTicketCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Bottom Account Menu */}
      <div
        ref={menuRef}
        className={`relative p-3 ${
          isDark ? 'border-t border-[#16281D]' : 'border-t border-[#E5E2D6]'
        }`}
      >
        {accountMenuOpen && (
          <div
            role="menu"
            aria-label="Account options"
            className={`absolute right-3 bottom-full left-3 mb-2 overflow-hidden rounded-xl border py-1.5 shadow-lg ${
              isDark
                ? 'border-[#1E3828] bg-[#0D1C13] text-[#EEF5F0]'
                : 'border-[#DCD9CD] bg-white text-[#11281B]'
            }`}
          >
            <div
              className={`px-3.5 py-2 text-xs ${
                isDark
                  ? 'border-b border-[#182E20] text-[#8EA797]'
                  : 'border-b border-[#ECE9DF] text-[#5B7063]'
              }`}
            >
              <p className={`truncate font-semibold ${isDark ? 'text-white' : 'text-[#11281B]'}`}>
                {displayName}
              </p>
              <p className="truncate">{displaySubtitle || 'Visitor workspace'}</p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavClick('profile')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              <UserIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleVisitorTheme();
                setAccountMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {isDark ? (
                  <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                onCloseMobile();
                onBackToHomepage();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                isDark ? 'hover:bg-[#14291C]' : 'hover:bg-[#F4F2EA]'
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Back to Homepage</span>
            </button>

            <div
              className={`my-1 ${
                isDark ? 'border-t border-[#182E20]' : 'border-t border-[#ECE9DF]'
              }`}
            />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                onCloseMobile();
                onSignOut();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold transition-colors ${
                isDark
                  ? 'text-[#FCA5A5] hover:bg-[#241313]'
                  : 'text-[#B91C1C] hover:bg-[#FEF2F2]'
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isDemoVisitor ? 'Sign out (Demo)' : 'Sign out'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountMenuOpen((o) => !o)}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
            isDark ? 'hover:bg-[#112217]' : 'hover:bg-[#EAE7DC]'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {renderAvatar('h-8 w-8')}
            <span
              className={`truncate text-sm font-semibold ${
                isDark ? 'text-white' : 'text-[#11281B]'
              }`}
            >
              {displayName}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              accountMenuOpen ? 'rotate-180' : ''
            } ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden w-[240px] shrink-0 border-r lg:block ${
          isDark ? 'border-[#172B1E]' : 'border-[#E3DFD3]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderBody(false)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside
            className={`relative z-10 h-full w-[268px] max-w-[85vw] border-r shadow-2xl ${
              isDark ? 'border-[#172B1E]' : 'border-[#E3DFD3]'
            }`}
          >
            {renderBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
