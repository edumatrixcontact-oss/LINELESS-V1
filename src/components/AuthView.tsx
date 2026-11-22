import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Lock, LogOut, Mail, User } from 'lucide-react';
import { formatAuthError, useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onSuccess: () => void;
  onBack?: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthView({
  onSuccess,
  onBack,
  initialMode = 'login',
}: AuthViewProps) {
  const {
    user,
    isStaff,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    authBusy,
    emailProviderDisabledNotice,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (mode === 'register') {
        await registerWithEmail(name, email, password);
      } else {
        await loginWithEmail(email, password);
      }
      onSuccess();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-8 sm:py-16">
      <div className="w-full max-w-md space-y-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#4E544E] hover:text-[#161A16] dark:text-[#A5ACA5] dark:hover:text-[#F2F1EC]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>
        )}

        <div className="surface-elevated overflow-hidden rounded-3xl border border-[#E3DFD6] bg-white p-7 sm:p-9 dark:border-[#242924] dark:bg-[#161A16]">
          {user ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#5EEAD4]">
                  Active Firebase Session
                </p>
                <h1 className="font-display text-2xl font-semibold text-[#161A16] dark:text-[#F2F1EC]">
                  Signed in as {user.displayName || user.email}
                </h1>
                <p className="text-sm text-[#545954] dark:text-[#9BA29B]">
                  {user.email} · Role:{' '}
                  <strong className="font-semibold text-[#161A16] dark:text-[#F2F1EC]">
                    {isStaff ? 'Staff' : 'Visitor'}
                  </strong>
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={onSuccess}
                  className="min-h-[48px] w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white transition-colors hover:bg-[#143627] dark:bg-[#2D6A4F] dark:hover:bg-[#3A8262]"
                >
                  Continue to Workspace
                </button>

                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => logout()}
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#D8D4CA] bg-[#FAF9F6] text-sm font-semibold text-[#2E332E] hover:bg-[#EFECE4] disabled:opacity-50 dark:border-[#2E342E] dark:bg-[#111411] dark:text-[#D5DAD5] dark:hover:bg-[#1F241F]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Sign Out &amp; Switch Account</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#5EEAD4]">
                  LINELESS Account
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-[#161A16] dark:text-[#F2F1EC]">
                  {mode === 'login' ? 'Sign in to continue' : 'Create your visitor account'}
                </h1>
                <p className="text-sm leading-relaxed text-[#545954] dark:text-[#9BA29B]">
                  {mode === 'login'
                    ? 'Access your active queue tickets, personal notifications, and visit history.'
                    : 'Register once to join queues digitally and receive real-time turn updates.'}
                </p>
              </div>

              {/* Segmented Mode Switch */}
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-[#EFECE4] p-1 dark:bg-[#1C211C]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                  }}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'login'
                      ? 'bg-white text-[#161A16] shadow-2xs dark:bg-[#252A25] dark:text-[#F2F1EC]'
                      : 'text-[#545954] hover:text-[#161A16] dark:text-[#9BA29B] dark:hover:text-[#F2F1EC]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                  }}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'register'
                      ? 'bg-white text-[#161A16] shadow-2xs dark:bg-[#252A25] dark:text-[#F2F1EC]'
                      : 'text-[#545954] hover:text-[#161A16] dark:text-[#9BA29B] dark:hover:text-[#F2F1EC]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Google Sign-In */}
              <div className="mt-6">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleGoogle}
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[#D8D4CA] bg-[#FAF9F6] px-4 text-sm font-semibold text-[#161A16] transition-colors hover:bg-[#EFECE4] disabled:opacity-50 dark:border-[#2C332C] dark:bg-[#111411] dark:text-[#F2F1EC] dark:hover:bg-[#1E231E]"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                  <span>Continue with Google</span>
                </button>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs font-medium text-[#6B706B] dark:text-[#8E948E]">
                <span className="h-px flex-1 bg-[#E3DFD6] dark:bg-[#242924]" />
                <span>or use email &amp; password</span>
                <span className="h-px flex-1 bg-[#E3DFD6] dark:bg-[#242924]" />
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-sm font-medium text-[#161A16] dark:text-[#F2F1EC]"
                    >
                      Full Name
                    </label>
                    <div className="relative mt-1.5">
                      <User
                        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B706B]"
                        aria-hidden="true"
                      />
                      <input
                        id="auth-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        maxLength={80}
                        className="min-h-[46px] w-full rounded-xl border border-[#D5D1C7] bg-[#FAF9F6] pr-4 pl-10 text-sm text-[#161A16] focus:border-[#1B4332] focus:outline-none dark:border-[#2E342E] dark:bg-[#0F120F] dark:text-[#F2F1EC] dark:focus:border-[#52B788]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-medium text-[#161A16] dark:text-[#F2F1EC]"
                  >
                    Email Address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B706B]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={160}
                      className="min-h-[46px] w-full rounded-xl border border-[#D5D1C7] bg-[#FAF9F6] pr-4 pl-10 text-sm text-[#161A16] focus:border-[#1B4332] focus:outline-none dark:border-[#2E342E] dark:bg-[#0F120F] dark:text-[#F2F1EC] dark:focus:border-[#52B788]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-sm font-medium text-[#161A16] dark:text-[#F2F1EC]"
                  >
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B706B]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'
                      }
                      className="min-h-[46px] w-full rounded-xl border border-[#D5D1C7] bg-[#FAF9F6] pr-4 pl-10 text-sm text-[#161A16] focus:border-[#1B4332] focus:outline-none dark:border-[#2E342E] dark:bg-[#0F120F] dark:text-[#F2F1EC] dark:focus:border-[#52B788]"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#B91C1C]/30 bg-[#FEF2F2] p-3.5 text-sm text-[#991B1B] dark:border-[#F87171]/30 dark:bg-[#2A1212] dark:text-[#FCA5A5]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {emailProviderDisabledNotice && (
                  <div className="rounded-xl border border-[#D97706]/35 bg-[#FEF3C7]/75 p-3.5 text-xs leading-relaxed text-[#92400E] dark:border-[#FBBF24]/30 dark:bg-[#451A03]/50 dark:text-[#FDE68A]">
                    <strong className="font-semibold">Firebase Console step required:</strong> Enable the{' '}
                    <em>Email/Password</em> provider in Firebase Console → Authentication → Sign-in method. Google Sign-In works immediately.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="min-h-[48px] w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white transition-colors hover:bg-[#143627] disabled:opacity-50 dark:bg-[#2D6A4F] dark:hover:bg-[#3A8262]"
                >
                  {authBusy
                    ? 'Please wait...'
                    : mode === 'register'
                    ? 'Create Visitor Account'
                    : 'Sign In'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs leading-relaxed text-[#5E635E] dark:text-[#8F968F]">
                {mode === 'register'
                  ? 'Public registration creates Visitor accounts only. Staff access is provisioned separately.'
                  : 'Sign in with your visitor account to manage queue tickets and receive turn alerts.'}
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
