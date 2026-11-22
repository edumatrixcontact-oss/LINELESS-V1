import { useState } from 'react';
import { ArrowRight, Mail, Megaphone, Monitor } from 'lucide-react';
import { QUICK_ANNOUNCEMENT_TEMPLATES } from '../../data/bankCatalog';
import { ViewMode } from '../../types/queue';

interface StaffPreviewSectionProps {
  onNavigate: (view: ViewMode) => void;
}

export function StaffPreviewSection({ onNavigate }: StaffPreviewSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    QUICK_ANNOUNCEMENT_TEMPLATES[0].id
  );
  const [customMessage, setCustomMessage] = useState('Service resumes at 2:00 PM.');

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    if (id === 'lunch') {
      setCustomMessage('Service resumes at 2:00 PM.');
      return;
    }
    const found = QUICK_ANNOUNCEMENT_TEMPLATES.find((t) => t.id === id);
    if (found) setCustomMessage(found.message);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
        {/* Left Copy & Staff Sign In */}
        <div className="space-y-4 lg:col-span-5">
          <h2 className="font-display text-3xl leading-[1.15] font-bold tracking-tight text-[#F6FAF7] sm:text-4xl">
            Reply to one visitor.
            <br />
            Update the whole branch.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-[#9CB3A4] sm:text-base">
            Answer private questions or send an update to everyone waiting.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onNavigate('staff-login')}
              className="inline-flex items-center gap-2 border-b border-[#7CEBA4]/50 pb-1 text-sm font-semibold text-[#F6FAF7] transition-colors hover:border-[#7CEBA4] hover:text-[#7CEBA4]"
            >
              <span>Staff sign in</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right: Staff — Lalbagh Branch Preview */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-[#233E2D] bg-gradient-to-br from-[#0F2116]/95 to-[#08130C]/95 p-4 shadow-2xl shadow-black/45 sm:p-5">
            <div className="flex items-center gap-2 border-b border-[#1D3426] pb-3">
              <Monitor className="h-4 w-4 text-[#D0E2D7]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#F4F8F5]">
                Staff — Lalbagh Branch
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              {/* Inbox (3) */}
              <div className="rounded-2xl border border-[#1E3627] bg-[#09160F] p-3.5 sm:col-span-5">
                <div className="flex items-center gap-2 border-b border-[#192D21] pb-2.5 text-xs font-semibold text-[#F4F8F5]">
                  <Mail className="h-3.5 w-3.5 text-[#CFE2D6]" aria-hidden="true" />
                  <span>Inbox (3)</span>
                </div>

                <div className="mt-2.5 space-y-2">
                  {[
                    { title: 'No ticket yet', meta: 'Question · Just now', active: true },
                    { title: 'B-106', meta: 'Question · 3 min ago', active: false },
                    { title: 'B-107', meta: 'Question · 6 min ago', active: false },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className={`rounded-xl border px-3 py-2.5 ${
                        item.active
                          ? 'border-[#335B43] bg-[#162C1E]'
                          : 'border-[#1C3325] bg-[#0D1C13]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7CEBA4]" />
                        <span className="text-xs font-semibold text-[#F4F8F5]">{item.title}</span>
                      </div>
                      <p className="mt-0.5 pl-3.5 text-[11px] text-[#9CB3A4]">{item.meta}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inline Send Announcement Composer */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#1E3627] bg-[#09160F] p-4 sm:col-span-7">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F8F5]">
                    <Megaphone className="h-3.5 w-3.5 text-[#7CEBA4]" aria-hidden="true" />
                    <span>Send announcement</span>
                  </div>

                  <div>
                    <label
                      htmlFor="home-staff-template"
                      className="block text-[11px] text-[#9CB3A4]"
                    >
                      Template
                    </label>
                    <select
                      id="home-staff-template"
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="mt-1 min-h-[36px] w-full rounded-lg border border-[#264332] bg-[#0F2016] px-2.5 text-xs font-medium text-[#EDF5EF] focus:border-[#7CEBA4] focus:outline-none"
                    >
                      {QUICK_ANNOUNCEMENT_TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="home-staff-msg" className="block text-[11px] text-[#9CB3A4]">
                      Message (to all waiting)
                    </label>
                    <textarea
                      id="home-staff-msg"
                      rows={2}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="mt-1 w-full resize-none rounded-lg border border-[#264332] bg-[#0F2016] px-3 py-2 text-xs text-[#EDF5EF] focus:border-[#7CEBA4] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleTemplateChange('lunch')}
                    className="min-h-[34px] rounded-lg border border-[#264332] px-3 text-xs font-semibold text-[#D6E6DC] hover:bg-[#13261B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('staff-login')}
                    className="min-h-[34px] rounded-lg bg-[#8CE6AE] px-3.5 text-xs font-bold text-[#082414] hover:bg-[#9EF0BE]"
                  >
                    Send to queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
