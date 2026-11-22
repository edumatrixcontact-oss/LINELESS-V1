import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  CheckCircle2,
  LogOut,
  Mail,
  ShieldCheck,
  Tag,
  Ticket as TicketIcon,
  Trash2,
} from 'lucide-react';
import { VisitorThemeMode } from './types';
import {
  EmailPreferenceSettings,
  compressAvatarFile,
  loadEmailPrefSettings,
  saveEmailPrefSettings,
  saveVisitorAvatar,
} from './visitorStorage';

interface VisitorProfileProps {
  visitorTheme: VisitorThemeMode;
  visitorUid: string | null;
  displayName: string;
  displayEmail: string;
  avatarUrl: string | null;
  isDemoVisitor: boolean;
  hasAuthenticatedUser: boolean;
  initialEmailOptIn: boolean;
  onUpdatePreferences: (updates: {
    name?: string;
    emailNotificationsEnabled?: boolean;
  }) => Promise<void>;
  onSignOut: () => void;
}

function ToggleSwitch({
  id,
  checked,
  onChange,
  label,
  isDark,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  isDark: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8A52] ${
        checked
          ? isDark
            ? 'border-[#4EB875] bg-[#2E8A52]'
            : 'border-[#1B4332] bg-[#1B4332]'
          : isDark
          ? 'border-[#243E2E] bg-[#102017]'
          : 'border-[#D4D0C4] bg-[#E5E1D6]'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function VisitorProfile({
  visitorTheme,
  visitorUid,
  displayName,
  displayEmail,
  avatarUrl,
  isDemoVisitor,
  hasAuthenticatedUser,
  initialEmailOptIn,
  onUpdatePreferences,
  onSignOut,
}: VisitorProfileProps) {
  const isDark = visitorTheme === 'dark';
  const [editName, setEditName] = useState(displayName);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferenceSettings>(() =>
    loadEmailPrefSettings(visitorUid, initialEmailOptIn)
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditName(displayName);
    setEmailPrefs(loadEmailPrefSettings(visitorUid, initialEmailOptIn));
  }, [displayName, visitorUid, initialEmailOptIn]);

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'V';

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !visitorUid) return;

    setPhotoBusy(true);
    setPhotoError('');
    try {
      const compressed = await compressAvatarFile(file);
      saveVisitorAvatar(visitorUid, compressed);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to upload photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    if (!visitorUid) return;
    setPhotoError('');
    saveVisitorAvatar(visitorUid, null);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPrefs) return;
    setSavingPrefs(true);
    setSavedMsg('');
    try {
      saveEmailPrefSettings(visitorUid, emailPrefs);
      if (!isDemoVisitor && hasAuthenticatedUser) {
        await onUpdatePreferences({
          name: editName,
          emailNotificationsEnabled: emailPrefs.ticketUpdates || emailPrefs.announcements,
        });
      }
      setSavedMsg('Preferences saved.');
      setTimeout(() => setSavedMsg(''), 3500);
    } finally {
      setSavingPrefs(false);
    }
  };

  const cardClass = isDark
    ? 'border-[#1B3324] bg-[#0B1710] text-[#EEF5F0]'
    : 'border-[#E2DFD3] bg-white text-[#10281B]';

  const subCardClass = isDark
    ? 'border-[#182E20] bg-[#08120C]'
    : 'border-[#ECE9DF] bg-[#FAF9F5]';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-7 sm:px-8">
      <div>
        <h1
          className={`font-display text-2xl font-bold tracking-tight sm:text-3xl ${
            isDark ? 'text-white' : 'text-[#10281B]'
          }`}
        >
          Profile &amp; Settings
        </h1>
        <p className={`mt-1 text-sm ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}>
          Manage your photo, account identity, and email notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Card: Profile Photo & Identity */}
        <section
          aria-label="Visitor profile"
          className={`flex flex-col justify-between rounded-2xl border p-6 lg:col-span-6 ${cardClass}`}
        >
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${displayName} profile`}
                    className={`h-24 w-24 rounded-full border-2 object-cover shadow-md ${
                      isDark ? 'border-[#348F59]' : 'border-[#1B4332]/25'
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full border-2 text-2xl font-bold ${
                      isDark
                        ? 'border-[#348F59] bg-[#17462B] text-[#DCF5E5]'
                        : 'border-[#1B4332]/20 bg-[#1B4332] text-white'
                    }`}
                  >
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload profile photo"
                  className={`absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60 ${
                    isDark
                      ? 'border-[#0B1710] bg-[#2E8A52]'
                      : 'border-white bg-[#1B4332]'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handlePhotoSelected(e)}
                />
              </div>

              <div className="mt-4 space-y-1 sm:mt-0">
                <h2
                  className={`font-display text-xl font-semibold ${
                    isDark ? 'text-white' : 'text-[#10281B]'
                  }`}
                >
                  {displayName}
                </h2>
                <p className={`text-xs ${isDark ? 'text-[#8CA696]' : 'text-[#546B5E]'}`}>
                  {displayEmail || 'Demo session'}
                </p>
                <p
                  className={`inline-flex items-center gap-1.5 pt-1 text-xs font-semibold ${
                    isDark ? 'text-[#8CE2AE]' : 'text-[#18603B]'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isDemoVisitor ? 'Demo Visitor' : 'Google Visitor Account'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-4 text-xs font-semibold disabled:opacity-50 ${
                  isDark
                    ? 'border-[#213B2B] bg-[#102218] text-[#D5E6DC] hover:bg-[#163022]'
                    : 'border-[#DCD9CD] bg-[#FAF9F5] text-[#1B4332] hover:bg-[#EFECE4]'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {photoBusy ? 'Processing...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold ${
                    isDark
                      ? 'border-[#213B2B] text-[#86A090] hover:text-[#FCA5A5]'
                      : 'border-[#DCD9CD] text-[#546B5E] hover:border-[#FCA5A5] hover:text-[#B91C1C]'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {photoError && (
              <p
                role="alert"
                className={`text-xs font-medium ${isDark ? 'text-[#FCA5A5]' : 'text-[#B91C1C]'}`}
              >
                {photoError}
              </p>
            )}

            <div
              className={`border-t pt-5 ${isDark ? 'border-[#16291D]' : 'border-[#ECE9DF]'}`}
            >
              <label htmlFor="visitor-profile-name" className="block text-sm font-medium">
                Display Name
              </label>
              <input
                id="visitor-profile-name"
                type="text"
                maxLength={80}
                disabled={isDemoVisitor || !hasAuthenticatedUser}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`mt-1.5 min-h-[44px] w-full rounded-xl border px-4 text-sm focus:outline-none disabled:opacity-60 ${
                  isDark
                    ? 'border-[#213B2B] bg-[#07100A] text-white focus:border-[#348F59]'
                    : 'border-[#D5D2C6] bg-[#FAF9F5] text-[#10281B] focus:border-[#1B4332]'
                }`}
              />
              {isDemoVisitor && (
                <p className={`mt-1.5 text-[11px] ${isDark ? 'text-[#7E9889]' : 'text-[#546B5E]'}`}>
                  Demo Visitor name is fixed during demo sessions. Sign in with Google to customize your account name.
                </p>
              )}
            </div>
          </div>

          <div
            className={`mt-6 flex justify-end border-t pt-5 ${
              isDark ? 'border-[#16291D]' : 'border-[#ECE9DF]'
            }`}
          >
            <button
              type="button"
              onClick={onSignOut}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-4 text-xs font-semibold ${
                isDark
                  ? 'border-[#213B2B] text-[#D5E6DC] hover:bg-[#14271B]'
                  : 'border-[#DCD9CD] text-[#2E3931] hover:bg-[#F2EFE8]'
              }`}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isDemoVisitor ? 'Exit Demo' : 'Sign Out'}</span>
            </button>
          </div>
        </section>

        {/* Right Card: Email Notifications Settings */}
        <form
          onSubmit={(e) => void handleSavePreferences(e)}
          aria-label="Email notification preferences"
          className={`flex flex-col justify-between rounded-2xl border p-6 lg:col-span-6 ${cardClass}`}
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isDark ? 'bg-[#13291C] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
                }`}
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Email Notifications</h2>
                <p className={`text-xs ${isDark ? 'text-[#8CA696]' : 'text-[#546B5E]'}`}>
                  Choose which queue alerts you want enabled for your account.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${subCardClass}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isDark ? 'bg-[#142B1D] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
                    }`}
                  >
                    <TicketIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor="switch-ticket-updates"
                      className="block cursor-pointer text-sm font-semibold"
                    >
                      Ticket Updates
                    </label>
                    <span className={`block text-xs ${isDark ? 'text-[#86A090]' : 'text-[#546B5E]'}`}>
                      Turn called, counter assigned &amp; status changes
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  id="switch-ticket-updates"
                  isDark={isDark}
                  checked={emailPrefs.ticketUpdates}
                  onChange={(val) => setEmailPrefs((p) => ({ ...p, ticketUpdates: val }))}
                  label="Toggle ticket updates notifications"
                />
              </div>

              <div
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${subCardClass}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isDark ? 'bg-[#142B1D] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
                    }`}
                  >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor="switch-announcements"
                      className="block cursor-pointer text-sm font-semibold"
                    >
                      Announcements
                    </label>
                    <span className={`block text-xs ${isDark ? 'text-[#86A090]' : 'text-[#546B5E]'}`}>
                      Branch notices and queue broadcasts from desk staff
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  id="switch-announcements"
                  isDark={isDark}
                  checked={emailPrefs.announcements}
                  onChange={(val) => setEmailPrefs((p) => ({ ...p, announcements: val }))}
                  label="Toggle queue announcements"
                />
              </div>

              <div
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${subCardClass}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isDark ? 'bg-[#142B1D] text-[#8CE2AE]' : 'bg-[#E5F6EC] text-[#18603B]'
                    }`}
                  >
                    <Tag className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor="switch-service-updates"
                      className="block cursor-pointer text-sm font-semibold"
                    >
                      Service Hours &amp; Updates
                    </label>
                    <span className={`block text-xs ${isDark ? 'text-[#86A090]' : 'text-[#546B5E]'}`}>
                      New service locations and seasonal schedule changes
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  id="switch-service-updates"
                  isDark={isDark}
                  checked={emailPrefs.serviceUpdates}
                  onChange={(val) => setEmailPrefs((p) => ({ ...p, serviceUpdates: val }))}
                  label="Toggle service hours updates"
                />
              </div>
            </div>
          </div>

          <div
            className={`mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5 ${
              isDark ? 'border-[#16291D]' : 'border-[#ECE9DF]'
            }`}
          >
            {savedMsg ? (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  isDark ? 'text-[#8CE2AE]' : 'text-[#18603B]'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{savedMsg}</span>
              </span>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={savingPrefs}
              className={`min-h-[40px] rounded-xl px-5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#73E8A4] text-[#052110] hover:bg-[#8DF0B6]'
                  : 'bg-[#1B4332] text-white hover:bg-[#143627]'
              }`}
            >
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
