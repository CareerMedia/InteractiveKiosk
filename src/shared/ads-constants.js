// ─────────────────────────────────────────────────────────────────────────────
// Kiosk idle ads — shared constants and helpers
// ─────────────────────────────────────────────────────────────────────────────

export const ADS_JSON_PATH = 'data/kiosk-ads.json';
export const ADS_DIR = 'assets/ads';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 250 * 1024 * 1024;

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
export const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);

export const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const DEFAULT_IDLE_DELAY_MS = 180_000;
export const DEFAULT_IMAGE_SLIDE_MS = 10_000;

export function emptyAdsData() {
  return {
    meta: {
      lastUpdatedAt: null,
      totalAds: 0,
      idleDelayMs: DEFAULT_IDLE_DELAY_MS,
      imageSlideDurationMs: DEFAULT_IMAGE_SLIDE_MS,
      randomize: true,
      testIdleAdsAt: null,
    },
    ads: [],
  };
}

export function sanitizeAdFilename(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'kiosk-ad';
}

export function formatAdTimestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function makeAdFilename(title, originalName) {
  const dot = String(originalName || '').lastIndexOf('.');
  const ext = dot > 0 ? originalName.slice(dot).toLowerCase() : '';
  const slug = sanitizeAdFilename(title).replace(/\.[^.]+$/, '');
  return `${slug || 'kiosk-ad'}-${formatAdTimestamp()}${ext}`;
}

export function createAdId(date = new Date()) {
  return `ad_${formatAdTimestamp(date)}`;
}

export function detectAdType(file) {
  const ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();

  if (IMAGE_MIMES.has(mime) || IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_MIMES.has(mime) || VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

export function validateAdFile(file) {
  if (!file || !file.name) {
    return { ok: false, error: 'Choose a file to upload.' };
  }

  const type = detectAdType(file);
  if (!type) {
    return {
      ok: false,
      error: 'Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV.',
    };
  }

  const max = type === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { ok: false, error: `File is too large. Maximum size is ${mb} MB for ${type}s.` };
  }

  return { ok: true, type };
}

export function filterActiveAds(data, now = new Date()) {
  return (data.ads || [])
    .filter((ad) => {
      if (!ad.active) return false;
      if (ad.startDate && new Date(ad.startDate) > now) return false;
      if (ad.endDate) {
        const end = new Date(ad.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      return Boolean(ad.src);
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
