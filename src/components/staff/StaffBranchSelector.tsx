import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  MapPin,
  Search,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  BANK_BRANCHES,
  BankBranchCatalogItem,
  DEMO_BRANCH_ACCESS_CODE,
} from '../../data/bankCatalog';
import { ThemeMode } from '../../types/queue';
import { BankEmblem } from '../BankEmblem';
import { LinelessMark } from '../home/LinelessMark';

interface StaffBranchSelectorProps {
  staffTheme: ThemeMode;
  staffName: string;
  staffEmail: string;
  isDemoStaff: boolean;
  firebaseUser: User | null;
  onUnlockBranch: (branchId: string) => void;
  onBackToHomepage: () => void;
  onSignOut: () => void;
}

export function StaffBranchSelector({
  staffTheme,
  staffName,
  staffEmail,
  isDemoStaff,
  firebaseUser,
  onUnlockBranch,
  onBackToHomepage,
  onSignOut,
}: StaffBranchSelectorProps) {
  const isDark = staffTheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [copiedDemoCode, setCopiedDemoCode] = useState(false);
  const [isTrackPaused, setIsTrackPaused] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return BANK_BRANCHES;
    return BANK_BRANCHES.filter(
      (b) =>
        b.bankName.toLowerCase().includes(q) ||
        b.branchName.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.area.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Subtle idle horizontal scroll that stops immediately on interaction, search, expansion, or reduced-motion
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (isTrackPaused || expandedBranchId || searchQuery.trim().length > 0) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let rafId = 0;
    let lastTs = performance.now();

    const step = (ts: number) => {
      const dt = Math.min(48, ts - lastTs);
      lastTs = ts;
      if (el.scrollWidth > el.clientWidth + 4) {
        const nextLeft = el.scrollLeft + dt * 0.018;
        if (nextLeft >= el.scrollWidth - el.clientWidth - 2) {
          el.scrollLeft = 0;
        } else {
          el.scrollLeft = nextLeft;
        }
      }
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [isTrackPaused, expandedBranchId, searchQuery, filteredBranches.length]);

  const scrollTrackBy = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 340, behavior: 'smooth' });
  };

  const handleSelectBranchCard = (branch: BankBranchCatalogItem) => {
    if (expandedBranchId === branch.id) return;
    setExpandedBranchId(branch.id);
    setAccessCode('');
    setShowCode(false);
    setVerifyError('');
  };

  const handleCopyDemoCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(DEMO_BRANCH_ACCESS_CODE);
      setCopiedDemoCode(true);
      window.setTimeout(() => setCopiedDemoCode(false), 2000);
    } catch {
      // Fallback: ignore clipboard unavailability
    }
  };

  const handleVerifySubmit = async (
    e: React.FormEvent,
    branch: BankBranchCatalogItem
  ) => {
    e.preventDefault();
    if (verifying) return;
    const submitted = accessCode.trim();
    setVerifyError('');

    if (!submitted) {
      setVerifyError('Enter the branch access code to continue.');
      return;
    }

    if (branch.isDemoBranch) {
      const expected = branch.demoAccessCode || DEMO_BRANCH_ACCESS_CODE;
      if (submitted === expected) {
        onUnlockBranch(branch.id);
      } else {
        setVerifyError(`Incorrect access code. Use ${expected} for the Lalbagh Demo Branch.`);
      }
      return;
    }

    if (!firebaseUser || isDemoStaff) {
      setVerifyError(
        'Live branches require an authorized Google staff sign-in. Choose Karnataka Bank — Lalbagh Road Branch (Demo) or sign in with Google staff credentials.'
      );
      return;
    }

    setVerifying(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/staff/verify-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          branchId: branch.id,
          accessCode: submitted,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        verified?: boolean;
        error?: string;
      };
      if (!res.ok || !payload.verified) {
        setVerifyError(
          payload.error || 'Access code verification failed. Please check the code and retry.'
        );
        return;
      }
      onUnlockBranch(branch.id);
    } catch {
      setVerifyError('Unable to verify branch code right now. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        isDark ? 'bg-[#060E09] text-[#F2F6F3]' : 'bg-[#FAF8F2] text-[#10281B]'
      }`}
    >
      {/* Top Staff Header */}
      <header
        className={`border-b ${
          isDark ? 'border-[#172B1E] bg-[#08130C]' : 'border-[#E3DFD3] bg-[#F5F3EC]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHomepage}
              className="flex items-center gap-2.5 text-left"
              title="Back to LINELESS Homepage"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isDark ? 'bg-[#2EA45F] text-white' : 'bg-[#1B4332] text-white'
                }`}
              >
                <LinelessMark size={16} />
              </span>
              <span className="font-display text-base font-bold tracking-[0.06em]">
                LINELESS
              </span>
            </button>
            <span
              className={`hidden h-4 w-px sm:inline-block ${
                isDark ? 'bg-[#243D2D]' : 'bg-[#D5D1C5]'
              }`}
              aria-hidden="true"
            />
            <span
              className={`hidden text-xs font-medium sm:inline ${
                isDark ? 'text-[#8EA797]' : 'text-[#546B5E]'
              }`}
            >
              Staff Workspace
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold">{staffName}</p>
              <p
                className={`text-[11px] ${
                  isDark ? 'text-[#8EA797]' : 'text-[#546B5E]'
                }`}
              >
                {isDemoStaff ? 'Demo staff session' : staffEmail}
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToHomepage}
              className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                isDark
                  ? 'border-[#1E3828] bg-[#0D1C13] text-[#DCE6DF] hover:bg-[#13281B]'
                  : 'border-[#DCD9CD] bg-white text-[#375142] hover:bg-[#EFECE3]'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Homepage</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                isDark
                  ? 'border-[#3A1E1E] bg-[#1D1111] text-[#FCA5A5] hover:bg-[#2A1616]'
                  : 'border-[#E6C4C4] bg-white text-[#991B1B] hover:bg-[#FEF2F2]'
              }`}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Branch Selection Stage */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Select a bank branch
            </h1>
            <p
              className={`mt-1.5 text-sm ${
                isDark ? 'text-[#9BB2A3]' : 'text-[#4D5E52]'
              }`}
            >
              Choose your branch and enter its access code to open the live queue and desk inbox.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTrackBy(-1)}
              aria-label="Scroll bank branches left"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isDark
                  ? 'border-[#1E3828] bg-[#0B1A11] text-[#D7E6DC] hover:bg-[#132A1C]'
                  : 'border-[#DDD9CD] bg-white text-[#10281B] hover:bg-[#F1EFE7]'
              }`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollTrackBy(1)}
              aria-label="Scroll bank branches right"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isDark
                  ? 'border-[#1E3828] bg-[#0B1A11] text-[#D7E6DC] hover:bg-[#132A1C]'
                  : 'border-[#DDD9CD] bg-white text-[#10281B] hover:bg-[#F1EFE7]'
              }`}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Search Filter */}
        <div className="mt-6 max-w-md">
          <label htmlFor="staff-branch-search" className="sr-only">
            Search bank branches
          </label>
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${
                isDark ? 'text-[#7B9685]' : 'text-[#607769]'
              }`}
              aria-hidden="true"
            />
            <input
              id="staff-branch-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bank name, branch, area, or city..."
              className={`min-h-[44px] w-full rounded-xl border pr-4 pl-10 text-sm focus:outline-none ${
                isDark
                  ? 'border-[#1E3828] bg-[#0B1A11] text-white placeholder:text-[#6E8978] focus:border-[#4AD17E]'
                  : 'border-[#D9D6C9] bg-white text-[#10281B] placeholder:text-[#6B7F72] focus:border-[#1B4332]'
              }`}
            />
          </div>
        </div>

        {/* Horizontal Branch Strip */}
        {filteredBranches.length === 0 ? (
          <div
            className={`mt-6 rounded-2xl border p-8 text-center ${
              isDark
                ? 'border-[#1A3122] bg-[#0B1A11] text-[#9EB5A6]'
                : 'border-[#E3E0D4] bg-white text-[#4D5E52]'
            }`}
          >
            <p className="text-sm font-semibold">No bank branches match &ldquo;{searchQuery}&rdquo;.</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`mt-3 inline-flex min-h-[38px] items-center rounded-xl border px-3.5 text-xs font-semibold ${
                isDark
                  ? 'border-[#254430] bg-[#122719] text-white'
                  : 'border-[#D6D3C6] bg-[#FAF8F2] text-[#10281B]'
              }`}
            >
              Show all branches
            </button>
          </div>
        ) : (
          <div
            ref={trackRef}
            onMouseEnter={() => setIsTrackPaused(true)}
            onMouseLeave={() => setIsTrackPaused(false)}
            onFocusCapture={() => setIsTrackPaused(true)}
            onBlurCapture={() => setIsTrackPaused(false)}
            onPointerDown={() => setIsTrackPaused(true)}
            className="mt-6 flex items-start gap-4 overflow-x-auto pb-4"
          >
            {filteredBranches.map((branch) => {
              const isExpanded = expandedBranchId === branch.id;
              return (
                <div
                  key={branch.id}
                  data-branch-id={branch.id}
                  className={`w-[320px] shrink-0 rounded-2xl border p-5 transition-colors sm:w-[348px] ${
                    isExpanded
                      ? isDark
                        ? 'border-[#4AD17E] bg-[#0E2216]'
                        : 'border-[#1B4332] bg-white'
                      : isDark
                      ? 'border-[#1A3122] bg-[#0B1A11] hover:border-[#2C533A]'
                      : 'border-[#E3E0D4] bg-white hover:border-[#B9C9BD]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectBranchCard(branch)}
                    aria-expanded={isExpanded}
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BankEmblem brand={branch.brandId} className="h-10 w-10" />
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold ${
                              isDark ? 'text-[#7BE0A2]' : 'text-[#18603B]'
                            }`}
                          >
                            {branch.bankName}
                          </p>
                          <h2 className="font-display mt-0.5 text-base font-bold leading-snug">
                            {branch.branchName}
                          </h2>
                        </div>
                      </div>
                      {branch.isDemoBranch && (
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            isDark
                              ? 'bg-[#18482B] text-[#9CF0BD]'
                              : 'bg-[#E2F4E9] text-[#11482B]'
                          }`}
                        >
                          Demo
                        </span>
                      )}
                    </div>

                    <div
                      className={`mt-3.5 space-y-1.5 text-xs ${
                        isDark ? 'text-[#98B0A1]' : 'text-[#546B5E]'
                      }`}
                    >
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{branch.address}</span>
                      </p>
                      <p className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{branch.hours}</span>
                        </span>
                        <span className="font-mono-tabular font-medium">
                          {branch.desks.length} {branch.desks.length === 1 ? 'desk' : 'desks'}
                        </span>
                      </p>
                    </div>
                  </button>

                  {/* Inline Access Code Prompt */}
                  {isExpanded && (
                    <form
                      onSubmit={(e) => void handleVerifySubmit(e, branch)}
                      className={`mt-4 space-y-3 border-t pt-4 ${
                        isDark ? 'border-[#1C3827]' : 'border-[#EAE7DC]'
                      }`}
                    >
                      {branch.isDemoBranch && (
                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                            isDark
                              ? 'border-[#255438] bg-[#132E1E] text-[#C6F3D7]'
                              : 'border-[#BCE2CC] bg-[#E8F6EE] text-[#11482B]'
                          }`}
                        >
                          <span>
                            Demo access code:{' '}
                            <strong className="font-mono-tabular font-bold">
                              {branch.demoAccessCode || DEMO_BRANCH_ACCESS_CODE}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => void handleCopyDemoCode(e)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                              isDark
                                ? 'bg-[#1D4B30] text-white hover:bg-[#255E3D]'
                                : 'bg-white text-[#103823] hover:bg-[#F5F3EC]'
                            }`}
                          >
                            {copiedDemoCode ? (
                              <>
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor={`branch-code-${branch.id}`}
                          className={`block text-xs font-semibold ${
                            isDark ? 'text-[#C3D6CA]' : 'text-[#375142]'
                          }`}
                        >
                          Branch access code
                        </label>
                        <div className="relative mt-1.5">
                          <Lock
                            className={`pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 ${
                              isDark ? 'text-[#7B9685]' : 'text-[#607769]'
                            }`}
                            aria-hidden="true"
                          />
                          <input
                            id={`branch-code-${branch.id}`}
                            type={showCode ? 'text' : 'password'}
                            autoFocus
                            value={accessCode}
                            onChange={(e) => {
                              setAccessCode(e.target.value);
                              if (verifyError) setVerifyError('');
                            }}
                            placeholder="Enter branch access code"
                            className={`font-mono-tabular min-h-[42px] w-full rounded-xl border pr-9 pl-9 text-sm focus:outline-none ${
                              isDark
                                ? 'border-[#264633] bg-[#08130C] text-white placeholder:text-[#668070] focus:border-[#4AD17E]'
                                : 'border-[#D5D2C5] bg-[#FAF8F2] text-[#10281B] placeholder:text-[#788D81] focus:border-[#1B4332]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCode((s) => !s)}
                            aria-label={showCode ? 'Hide access code' : 'Show access code'}
                            className={`absolute top-1/2 right-2.5 -translate-y-1/2 p-1 ${
                              isDark
                                ? 'text-[#89A594] hover:text-white'
                                : 'text-[#5A7265] hover:text-[#10281B]'
                            }`}
                          >
                            {showCode ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      {verifyError && (
                        <div
                          role="alert"
                          className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                            isDark
                              ? 'border-[#5A2424] bg-[#251212] text-[#FCA5A5]'
                              : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                          }`}
                        >
                          {verifyError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={verifying}
                        className={`flex min-h-[42px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                          isDark
                            ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                            : 'bg-[#1B4332] text-white hover:bg-[#143627]'
                        }`}
                      >
                        {verifying ? 'Verifying...' : 'Open branch dashboard'}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
