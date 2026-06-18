// ─────────────────────────────────────────────────────────────────────────────
// Resolves the API server base URL for kiosk + admin.
//
// GitHub Pages is static-only and cannot run Node. The API runs on Vercel
// (see vercel.json) or locally via `npm start`.
// ─────────────────────────────────────────────────────────────────────────────

import { JOBS_CONFIG } from '../config/jobs.js';
import { loadConfig } from './config.js';

let _resolvedBase = null;
let _apiAvailable = false;
let _resolvePromise = null;

async function probe(base) {
  const b = (base || '').replace(/\/+$/, '');
  const url = `${b}/api/health`;
  try {
    const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveApiBase({ force = false } = {}) {
  if (!force && _resolvedBase !== null) {
    return { base: _resolvedBase, available: _apiAvailable };
  }
  if (!force && _resolvePromise) return _resolvePromise;

  _resolvePromise = (async () => {
    if (await probe('')) {
      _resolvedBase = '';
      _apiAvailable = true;
      return { base: '', available: true };
    }

    try {
      const cfg = await loadConfig({ force });
      if (cfg.apiBaseUrl && await probe(cfg.apiBaseUrl)) {
        _resolvedBase = cfg.apiBaseUrl.replace(/\/+$/, '');
        _apiAvailable = true;
        return { base: _resolvedBase, available: true };
      }
    } catch { /* ignore */ }

    if (JOBS_CONFIG.apiBaseUrl && await probe(JOBS_CONFIG.apiBaseUrl)) {
      _resolvedBase = JOBS_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      _apiAvailable = true;
      return { base: _resolvedBase, available: true };
    }

    _resolvedBase = '';
    _apiAvailable = false;
    return { base: '', available: false };
  })();

  const result = await _resolvePromise;
  _resolvePromise = null;
  return result;
}

export async function apiUrl(path) {
  const { base } = await resolveApiBase();
  return `${base}${path}`;
}

export async function isApiAvailable({ force = false } = {}) {
  const { available } = await resolveApiBase({ force });
  return available;
}

export function invalidateApiBaseCache() {
  _resolvedBase = null;
  _apiAvailable = false;
  _resolvePromise = null;
}
