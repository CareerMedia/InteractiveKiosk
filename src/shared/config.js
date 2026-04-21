// ─────────────────────────────────────────────────────────────────────────────
// Runtime config reader
//
// The kiosk and /mobile page both fetch `config.json` from the repo at
// startup. That file is written by the /admin dashboard and contains any
// admin-edited settings (currently just the map URL, plus a `version`
// counter the kiosk uses to invalidate its logo cache when admin commits).
//
// config.json lives at the *same origin* as whatever page loads this
// module (e.g. GitHub Pages), so no CORS proxy is needed. We bust the
// CDN cache with a timestamped query string — GitHub Pages can cache
// for a few minutes otherwise.
// ─────────────────────────────────────────────────────────────────────────────

import { MAP_CONFIG } from '../config/map.js';

// config.json always lives at the site root. /mobile/ and /admin/ are
// one level deeper; the main kiosk is at the root itself. Strip a
// trailing `mobile/` or `admin/` from the current path to get the root.
function configUrl() {
  const { origin, pathname } = window.location;
  let root = pathname.replace(/[^/]*$/, '');       // drop filename, keep slash
  root = root.replace(/(?:^|\/)(?:mobile|admin)\/+$/, '/');
  if (!root.endsWith('/')) root += '/';
  return `${origin}${root}config.json?t=${Date.now()}`;
}

// Module-scoped cache so repeat callers don't hit the network multiple times.
let _configPromise = null;

export function loadConfig({ force = false } = {}) {
  if (_configPromise && !force) return _configPromise;
  _configPromise = (async () => {
    try {
      const res = await fetch(configUrl(), { cache: 'no-store' });
      if (!res.ok) return fallbackConfig();
      const data = await res.json();
      return {
        mapUrl:    typeof data.mapUrl === 'string' && data.mapUrl ? data.mapUrl : MAP_CONFIG.embedUrl,
        version:   Number.isFinite(data.version) ? data.version : 0,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      };
    } catch {
      return fallbackConfig();
    }
  })();
  return _configPromise;
}

function fallbackConfig() {
  return { mapUrl: MAP_CONFIG.embedUrl, version: 0, updatedAt: null };
}

// Build the same URL the kiosk iframe loads, with the embed/kiosk params set.
export function buildMapUrl(base) {
  try {
    const url = new URL(base || MAP_CONFIG.embedUrl);
    if (!url.searchParams.has('embedded')) url.searchParams.set('embedded', 'true');
    if (!url.searchParams.has('kiosk'))    url.searchParams.set('kiosk', 'true');
    return url.toString();
  } catch {
    return base || MAP_CONFIG.embedUrl;
  }
}
