import React, { useMemo, useState } from 'react';
import { Check, Clock, Megaphone, Trash2, X } from 'lucide-react';
import {
  BankBranchCatalogItem,
  BankDeskCatalogItem,
  QUICK_ANNOUNCEMENT_TEMPLATES,
} from '../../data/bankCatalog';
import { Announcement, ThemeMode } from '../../types/queue';

interface StaffAnnouncementOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  staffTheme: ThemeMode;
  branch: BankBranchCatalogItem;
  selectedDesk: BankDeskCatalogItem;
  branchAnnouncements: Announcement[];
  onPublishAnnouncement: (
    serviceId: string,
    message: string,
    expiresAt: number | null
  ) => Promise<void>;
  onClearAnnouncement: (announcementId: string) => Promise<void>;
}

const EXPIRY_OPTIONS: Array<{ label: string; minutes: number | null }> = [
  { label: 'No expiry', minutes: null },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export function StaffAnnouncementOverlay({
  isOpen,
  onClose,
  staffTheme,
  branch,
  selectedDesk,
  branchAnnouncements,
  onPublishAnnouncement,
  onClearAnnouncement,
}: StaffAnnouncementOverlayProps) {
  const isDark = staffTheme === 'dark';

  const [scope, setScope] = useState<'branch' | 'desk'>('branch');
  const [messageText, setMessageText] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState<number | null>(60);
  const [submitting, setSubmitting] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Deduplicate multi-desk branch announcements into clean logical notices for display
  const dedupedAnnouncements = useMemo(() => {
    const seen = new Map<string, { primary: Announcement; ids: string[] }>();
    for (const ann of branchAnnouncements) {
      const bucket = `${ann.message}::${Math.floor(ann.createdAt / 5000)}`;
      const existing = seen.get(bucket);
      if (existing) {
        existing.ids.push(ann.id);
      } else {
        seen.set(bucket, { primary: ann, ids: [ann.id] });
      }
    }
    return Array.from(seen.values());
  }, [branchAnnouncements]);

  if (!isOpen) return null;

  const handleTemplateClick = (templateText: string) => {
    setMessageText(templateText);
    setPublishError('');
    setPublishSuccess(false);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = messageText.trim();
    if (!clean) {
      setPublishError('Enter an announcement message before publishing.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setPublishError('');
    setPublishSuccess(false);

    const expiresAt =
      typeof expiryMinutes === 'number' ? Date.now() + expiryMinutes * 60_000 : null;

    try {
      if (scope === 'branch') {
        for (const desk of branch.desks) {
          await onPublishAnnouncement(desk.queueServiceId, clean, expiresAt);
        }
      } else {
        await onPublishAnnouncement(selectedDesk.queueServiceId, clean, expiresAt);
      }
      setPublishSuccess(true);
      setMessageText('');
    } catch (err) {
      setPublishError(
        err instanceof Error
          ? err.message
          : 'Unable to publish announcement right now. Your draft has been kept.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearGroup = async (ids: string[]) => {
    for (const id of ids) {
      await onClearAnnouncement(id);
    }
  };

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-announcement-title"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className={`relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-6 ${
          isDark
            ? 'border-[#1E3828] bg-[#0B1A11] text-[#F2F6F3]'
            : 'border-[#DCD9CD] bg-white text-[#10281B]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 border-b pb-4 ${
            isDark ? 'border-[#1A3122]' : 'border-[#EAE7DC]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isDark ? 'bg-[#173D26] text-[#7CEBA4]' : 'bg-[#E2F4E9] text-[#18603B]'
              }`}
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="staff-announcement-title" className="font-display text-lg font-bold">
                Send announcement
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#8FA899]' : 'text-[#546B5E]'}`}>
                Visible to waiting and QR walk-in visitors at {branch.displayName}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close announcement composer"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isDark
                ? 'border-[#1E3828] bg-[#0E2216] text-[#A9C2B3] hover:text-white'
                : 'border-[#DCD9CD] bg-[#FAF8F2] text-[#4D5E52] hover:text-[#10281B]'
            }`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handlePublish(e)} className="mt-4 space-y-4">
          {/* Scope Selector */}
          {branch.desks.length > 1 && (
            <div>
              <p
                className={`text-xs font-semibold ${
                  isDark ? 'text-[#B5CCBE]' : 'text-[#375142]'
                }`}
              >
                Audience
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScope('branch')}
                  className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    scope === 'branch'
                      ? isDark
                        ? 'border-[#348F59] bg-[#164228] text-white'
                        : 'border-[#1B4332] bg-[#1B4332] text-white'
                      : isDark
                      ? 'border-[#1E3828] bg-[#08130C] text-[#9AB3A4]'
                      : 'border-[#D8D5C8] bg-[#FAF8F2] text-[#375142]'
                  }`}
                >
                  All branch desks ({branch.desks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('desk')}
                  className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    scope === 'desk'
                      ? isDark
                        ? 'border-[#348F59] bg-[#164228] text-white'
                        : 'border-[#1B4332] bg-[#1B4332] text-white'
                      : isDark
                      ? 'border-[#1E3828] bg-[#08130C] text-[#9AB3A4]'
                      : 'border-[#D8D5C8] bg-[#FAF8F2] text-[#375142]'
                  }`}
                >
                  {selectedDesk.name} only
                </button>
              </div>
            </div>
          )}

          {/* Quick Templates (populates text only, never auto-publishes) */}
          <div>
            <p
              className={`text-xs font-semibold ${
                isDark ? 'text-[#B5CCBE]' : 'text-[#375142]'
              }`}
            >
              Quick templates
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK_ANNOUNCEMENT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleTemplateClick(tpl.message)}
                  className={`min-h-[32px] rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                    isDark
                      ? 'border-[#1F3A29] bg-[#0E2015] text-[#BFE8CF] hover:bg-[#163121]'
                      : 'border-[#DAD7CA] bg-[#FAF8F2] text-[#284233] hover:bg-[#E8F6EE]'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Box */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="staff-announcement-message"
                className={`text-xs font-semibold ${
                  isDark ? 'text-[#B5CCBE]' : 'text-[#375142]'
                }`}
              >
                Message
              </label>
              <span
                className={`font-mono-tabular text-[11px] ${
                  isDark ? 'text-[#7F9A8A]' : 'text-[#5E7366]'
                }`}
              >
                {messageText.length}/240
              </span>
            </div>
            <textarea
              id="staff-announcement-message"
              rows={3}
              maxLength={240}
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                if (publishError) setPublishError('');
                if (publishSuccess) setPublishSuccess(false);
              }}
              placeholder="Write a concise update for everyone waiting in the branch queue..."
              className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                isDark
                  ? 'border-[#254330] bg-[#07110B] text-white placeholder:text-[#668070] focus:border-[#4AD17E]'
                  : 'border-[#D5D2C5] bg-[#FAF8F2] text-[#10281B] placeholder:text-[#788D81] focus:border-[#1B4332]'
              }`}
            />
          </div>

          {/* Expiry Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                isDark ? 'text-[#B5CCBE]' : 'text-[#375142]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Auto-expire</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setExpiryMinutes(opt.minutes)}
                  className={`min-h-[30px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                    expiryMinutes === opt.minutes
                      ? isDark
                        ? 'border-[#348F59] bg-[#164228] text-white'
                        : 'border-[#1B4332] bg-[#E2F4E9] text-[#103823]'
                      : isDark
                      ? 'border-[#1D3526] bg-[#08130C] text-[#97B0A1]'
                      : 'border-[#DCD9CD] bg-white text-[#4D5E52]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Visitor Preview */}
          {messageText.trim().length > 0 && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                isDark
                  ? 'border-[#224C34] bg-[#0F2619] text-[#CBEFD9]'
                  : 'border-[#BCE2CC] bg-[#E8F6EE] text-[#11482B]'
              }`}
            >
              <p className="text-[11px] font-semibold opacity-80">Visitor banner preview</p>
              <p className="mt-0.5 font-medium">
                {branch.displayName} · {messageText.trim()}
              </p>
            </div>
          )}

          {publishError && (
            <div
              role="alert"
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                isDark
                  ? 'border-[#5A2424] bg-[#251212] text-[#FCA5A5]'
                  : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              {publishError}
            </div>
          )}

          {publishSuccess && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                isDark
                  ? 'border-[#2B6844] bg-[#143722] text-[#9EF0BE]'
                  : 'border-[#9AD8B4] bg-[#E2F4E9] text-[#11482B]'
              }`}
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Announcement published to active branch visitors.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[40px] rounded-xl border px-4 text-xs font-semibold whitespace-nowrap ${
                isDark
                  ? 'border-[#223F2D] bg-[#0B1A11] text-[#C6D8CD] hover:bg-[#12261A]'
                  : 'border-[#DCD9CD] bg-white text-[#375142] hover:bg-[#F4F1E8]'
              }`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`min-h-[40px] rounded-xl px-4 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#2EA45F] text-white hover:bg-[#258C50]'
                  : 'bg-[#1B4332] text-white hover:bg-[#143627]'
              }`}
            >
              {submitting ? 'Publishing...' : 'Publish announcement'}
            </button>
          </div>
        </form>

        {/* Active / Recent Branch Announcements */}
        {dedupedAnnouncements.length > 0 && (
          <div
            className={`mt-5 border-t pt-4 ${
              isDark ? 'border-[#1A3122]' : 'border-[#EAE7DC]'
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                isDark ? 'text-[#B5CCBE]' : 'text-[#375142]'
              }`}
            >
              Recent announcements (click to reuse text)
            </p>
            <div className="mt-2 space-y-2">
              {dedupedAnnouncements.slice(0, 4).map(({ primary, ids }) => (
                <div
                  key={primary.id}
                  className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    isDark
                      ? 'border-[#1A3122] bg-[#08130C]'
                      : 'border-[#E6E3D7] bg-[#FAF8F2]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleTemplateClick(primary.message)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium leading-snug">{primary.message}</p>
                    <p
                      className={`font-mono-tabular mt-1 text-[11px] ${
                        isDark ? 'text-[#7F9A8A]' : 'text-[#5E7366]'
                      }`}
                    >
                      Sent {formatTime(primary.createdAt)}
                      {primary.expiresAt ? ` · Expires ${formatTime(primary.expiresAt)}` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClearGroup(ids)}
                    aria-label="Clear announcement"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isDark
                        ? 'text-[#9AB3A4] hover:bg-[#281515] hover:text-[#FCA5A5]'
                        : 'text-[#607769] hover:bg-[#FEE2E2] hover:text-[#991B1B]'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
