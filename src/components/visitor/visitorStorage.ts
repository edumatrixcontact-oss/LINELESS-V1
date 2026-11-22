export interface EmailPreferenceSettings {
  ticketUpdates: boolean;
  announcements: boolean;
  serviceUpdates: boolean;
}

const AVATAR_PREFIX = 'lineless_visitor_avatar_v1_';
const EMAIL_PREFS_PREFIX = 'lineless_visitor_email_prefs_v1_';
const BRANCH_MSG_INDEX_PREFIX = 'lineless_visitor_branch_msgs_v1_';
const BRANCH_SESSIONS_PREFIX = 'lineless_visitor_branch_sessions_v1_';
export const VISITOR_AVATAR_EVENT = 'lineless:visitor-avatar-changed';

export function getVisitorAvatarStorageKey(uid: string): string {
  return `${AVATAR_PREFIX}${uid || 'default'}`;
}

export function loadVisitorAvatar(uid: string | null): string | null {
  if (!uid) return null;
  try {
    const val = localStorage.getItem(getVisitorAvatarStorageKey(uid));
    if (val && val.startsWith('data:image/')) {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveVisitorAvatar(uid: string | null, dataUrl: string | null): void {
  if (!uid) return;
  try {
    const key = getVisitorAvatarStorageKey(uid);
    if (dataUrl) {
      localStorage.setItem(key, dataUrl);
    } else {
      localStorage.removeItem(key);
    }
    window.dispatchEvent(new CustomEvent(VISITOR_AVATAR_EVENT, { detail: { uid, dataUrl } }));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function compressAvatarFile(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please choose a PNG, JPG, WEBP, or GIF image.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image must be under 10 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to read image file.'));
      el.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas unavailable for image processing.');
    }

    const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - minSide) / 2));
    const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - minSide) / 2));

    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    const webp = canvas.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp') && webp.length < 180_000) {
      return webp;
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function loadEmailPrefSettings(
  uid: string | null,
  fallbackEnabled: boolean
): EmailPreferenceSettings {
  const defaults: EmailPreferenceSettings = {
    ticketUpdates: fallbackEnabled,
    announcements: fallbackEnabled,
    serviceUpdates: false,
  };
  if (!uid) return defaults;
  try {
    const raw = localStorage.getItem(`${EMAIL_PREFS_PREFIX}${uid}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<EmailPreferenceSettings>;
    return {
      ticketUpdates:
        typeof parsed.ticketUpdates === 'boolean' ? parsed.ticketUpdates : defaults.ticketUpdates,
      announcements:
        typeof parsed.announcements === 'boolean' ? parsed.announcements : defaults.announcements,
      serviceUpdates:
        typeof parsed.serviceUpdates === 'boolean'
          ? parsed.serviceUpdates
          : defaults.serviceUpdates,
    };
  } catch {
    return defaults;
  }
}

export function saveEmailPrefSettings(uid: string | null, prefs: EmailPreferenceSettings): void {
  if (!uid) return;
  try {
    localStorage.setItem(`${EMAIL_PREFS_PREFIX}${uid}`, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures
  }
}

export function loadBranchMessageOwnership(uid: string | null): Record<string, string> {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`${BRANCH_MSG_INDEX_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveBranchMessageOwnership(
  uid: string | null,
  map: Record<string, string>
): void {
  if (!uid) return;
  try {
    localStorage.setItem(`${BRANCH_MSG_INDEX_PREFIX}${uid}`, JSON.stringify(map));
  } catch {
    // Ignore storage failures
  }
}

export function loadBranchSessions<T>(uid: string | null): Record<string, T> {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`${BRANCH_SESSIONS_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

export function saveBranchSessions<T>(uid: string | null, map: Record<string, T>): void {
  if (!uid) return;
  try {
    localStorage.setItem(`${BRANCH_SESSIONS_PREFIX}${uid}`, JSON.stringify(map));
  } catch {
    // Ignore storage failures
  }
}

export async function shareTicketDetails(params: {
  ticketNumber: string;
  serviceName: string;
  locationName: string;
  status: string;
  estimatedWaitMinutes?: number | null;
  position?: number | null;
  counter?: string | null;
}): Promise<'shared' | 'copied' | 'failed'> {
  const lines = [
    `LINELESS Queue Ticket: ${params.ticketNumber}`,
    `Service: ${params.serviceName}`,
    `Location: ${params.locationName}`,
    `Status: ${params.status.toUpperCase()}`,
    params.counter ? `Counter: ${params.counter}` : null,
    typeof params.position === 'number' ? `Queue Position: #${params.position}` : null,
    typeof params.estimatedWaitMinutes === 'number'
      ? `Estimated Wait: ~${params.estimatedWaitMinutes} min`
      : null,
  ].filter(Boolean);

  const text = lines.join('\n');

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `LINELESS Ticket ${params.ticketNumber}`,
        text,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'failed';
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
