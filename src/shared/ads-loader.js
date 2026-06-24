// ─────────────────────────────────────────────────────────────────────────────
// Kiosk idle ads loader
// ─────────────────────────────────────────────────────────────────────────────

import { apiUrl, isApiAvailable } from './api-base.js';
import { ADS_JSON_PATH, emptyAdsData } from './ads-constants.js';

function adsJsonUrl() {
  const { origin, pathname } = window.location;
  let root = pathname.replace(/[^/]*$/, '');
  root = root.replace(/(?:^|\/)(?:mobile|admin)\/+$/, '/');
  if (!root.endsWith('/')) root += '/';
  return `${origin}${root}${ADS_JSON_PATH}?t=${Date.now()}`;
}

let _adsPromise = null;

export async function loadActiveAds({ force = false } = {}) {
  if (_adsPromise && !force) return _adsPromise;

  _adsPromise = (async () => {
    const { available } = await isApiAvailable({ force });
    if (available) {
      try {
        const res = await fetch(await apiUrl('/api/ads'), { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch { /* fall through */ }
    }

    try {
      const res = await fetch(adsJsonUrl(), { cache: 'no-store' });
      if (!res.ok) return emptyPublicAds();
      const data = await res.json();
      return filterPublicFromJson(data);
    } catch {
      return emptyPublicAds();
    }
  })();

  return _adsPromise;
}

function emptyPublicAds() {
  const base = emptyAdsData();
  return {
    meta: base.meta,
    ads: [],
  };
}

function filterPublicFromJson(data) {
  const now = new Date();
  const ads = (data.ads || [])
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
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ad) => ({
      id: ad.id,
      title: ad.title,
      type: ad.type,
      src: ad.src,
      thumbnailSrc: ad.thumbnailSrc || (ad.type === 'image' ? ad.src : ''),
      durationSeconds: ad.durationSeconds ?? null,
      order: ad.order ?? 0,
    }));

  return {
    meta: {
      idleDelayMs: data.meta?.idleDelayMs ?? 180_000,
      imageSlideDurationMs: data.meta?.imageSlideDurationMs ?? 10_000,
      randomize: data.meta?.randomize !== false,
      totalActive: ads.length,
      testIdleAdsAt: data.meta?.testIdleAdsAt || null,
    },
    ads,
  };
}

export function resolveAdAssetUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  const { origin, pathname } = window.location;
  let root = pathname.replace(/[^/]*$/, '');
  root = root.replace(/(?:^|\/)(?:mobile|admin)\/+$/, '/');
  if (!root.endsWith('/')) root += '/';
  const path = src.startsWith('/') ? src.slice(1) : src;
  return `${origin}${root}${path}`;
}
