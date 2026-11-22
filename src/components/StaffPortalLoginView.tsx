import { useState } from 'react';
import { AlertCircle, ArrowLeft, LogOut } from 'lucide-react';
import { formatAuthError, useAuth } from '../context/AuthContext';
import { LinelessMark } from './home/LinelessMark';

interface StaffPortalLoginViewProps {
  onBackToHomepage: () => void;
  onStaffAuthenticated: () => void;
  onEnterDemoStaff: () => void;
  directUnauthorizedNotice?: boolean;
}

export function StaffPortalLoginView({
  onBackToHomepage,
  onStaffAuthenticated,
  onEnterDemoStaff,
  directUnauthorizedNotice = false,
}: StaffPortalLoginViewProps) {
  const { user, isStaff, loginWithGoogle, logout, authBusy } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const handleContinueWithGoogle = async () => {
    setErrorMsg('');
    setDeniedEmail(null);

    try {
      const { user: signedInUser, isAuthorizedStaff } = await loginWithGoogle({
        forceAccountSelect: true,
        clearDemoMode: 'staff',
      });

      if (isAuthorizedStaff) {
        onStaffAuthenticated();
      } else {
        setDeniedEmail(signedInUser.email || signedInUser.displayName || 'this account');
      }
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    }
  };

  const activeVisitorDenied =
    deniedEmail ||
    (directUnauthorizedNotice && user && !isStaff
      ? user.email || user.displayName || 'this account'
      : null);

  return (
    <div className="lineless-home-bg relative flex min-h-screen flex-col justify-between overflow-x-clip text-[#121E16] transition-colors duration-200 dark:text-[#F3F1EA]">
      {/* Subtle Architectural Emerald Arcs Backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-55 dark:opacity-100"
      >
        <path
          d="M-140 640 C 320 420, 860 660, 1560 320"
          stroke="currentColor"
          className="text-[#1F6842]/12 dark:text-[#2E6B47]/28"
          strokeWidth="1.2"
        />
        <circle
          cx="1160"
          cy="180"
          r="340"
          stroke="currentColor"
          className="text-[#1F6842]/10 dark:text-[#2E6B47]/20"
          strokeWidth="1"
        />
      </svg>

      {/* Top Subtle Back Navigation */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-8">
        <button
          type="button"
          onClick={onBackToHomepage}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 text-sm font-medium text-[#4D5E52] transition-colors hover:bg-black/5 hover:text-[#121E16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6842] dark:text-[#9EB1A5] dark:hover:bg-white/5 dark:hover:text-[#F3F1EA] dark:focus-visible:outline-[#4EB875]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Homepage</span>
        </button>
      </header>

      {/* Centered Minimal Staff Login Card */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="surface-elevated w-full rounded-[28px] border border-[#DFDAD0] bg-white/95 p-8 backdrop-blur-md sm:p-10 dark:border-[#1E3225] dark:bg-[#0B1710]/95">
          {/* LINELESS Brand & Portal Title */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <LinelessMark size={28} className="text-[#1F6842] dark:text-[#4EB875]" />
              <span className="font-display text-lg font-bold tracking-[0.06em] text-[#121E16] dark:text-[#F3F1EA]">
                LINELESS
              </span>
            </div>

            <h1 className="font-display mt-6 text-3xl font-semibold tracking-tight text-[#121E16] sm:text-[34px] dark:text-[#F3F1EA]">
              Staff Portal
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-[#4D5E52] dark:text-[#9EB1A5]">
              Sign in to your staff account
            </p>
          </div>

          {/* Access Denied Banner for Non-Staff Google Accounts */}
          {activeVisitorDenied && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-[#B91C1C]/30 bg-[#FEF2F2] p-4 text-left text-xs leading-relaxed text-[#7F1D1D] dark:border-[#F87171]/30 dark:bg-[#231010] dark:text-[#FECACA]"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1.5">
                  <p className="font-semibold">Access denied</p>
                  <p>
                    The account <span className="font-semibold">{activeVisitorDenied}</span> is not
                    authorized for staff access. Only authorized staff accounts can open the Staff
                    Dashboard.
                  </p>
                  {user && !isStaff && (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        setDeniedEmail(null);
                        void logout();
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 font-semibold underline hover:no-underline disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign out of visitor account</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Auth Error Message */}
          {errorMsg && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#B91C1C]/30 bg-[#FEF2F2] p-3.5 text-xs leading-relaxed text-[#7F1D1D] dark:border-[#F87171]/30 dark:bg-[#231010] dark:text-[#FECACA]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Action: Continue with Google */}
          <div className="mt-8 space-y-5">
            <button
              type="button"
              disabled={authBusy}
              onClick={handleContinueWithGoogle}
              className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-full bg-[#1F633F] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#174F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:opacity-55 dark:bg-[#236B44] dark:hover:bg-[#2C8253] dark:focus-visible:outline-[#4EB875]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </span>
              <span>{authBusy ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            {/* Subtle OR Divider */}
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-widest text-[#708076] uppercase dark:text-[#688072]">
              <span className="h-px flex-1 bg-[#DFDAD0] dark:bg-[#1C3024]" />
              <span>OR</span>
              <span className="h-px flex-1 bg-[#DFDAD0] dark:bg-[#1C3024]" />
            </div>

            {/* Secondary Demo Staff Access */}
            <div className="space-y-2.5 text-center">
              <button
                type="button"
                onClick={onEnterDemoStaff}
                className="flex min-h-[46px] w-full items-center justify-center rounded-full border border-[#CFC9BC] bg-[#FAF8F2] px-6 text-sm font-semibold text-[#1A2A20] transition-colors hover:border-[#1F633F] hover:bg-[#EFECE3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] dark:border-[#243B2D] dark:bg-[#0E1D14] dark:text-[#D5E1D9] dark:hover:border-[#4EB875] dark:hover:bg-[#14271C] dark:focus-visible:outline-[#4EB875]"
              >
                Enter Demo Staff Portal
              </button>

              <p className="text-xs text-[#5E6F64] dark:text-[#869B8E]">
                Explore staff operations in demo mode.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Spacer */}
      <div className="relative z-10 py-4 text-center text-xs text-[#6B7A70] dark:text-[#5B7264]">
        LINELESS · A smarter way to wait
      </div>
    </div>
  );
}
