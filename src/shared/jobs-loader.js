// ─────────────────────────────────────────────────────────────────────────────
// Runtime jobs data loader (kiosk)
// ─────────────────────────────────────────────────────────────────────────────

import { apiUrl, isApiAvailable, resolveApiBase } from './api-base.js';

export { formatJobDate } from './jobs-parser.js';
export { MAX_EMAIL_JOBS } from './jobs-constants.js';

function jobsJsonUrl() {
  const { origin, pathname } = window.location;
  let root = pathname.replace(/[^/]*$/, '');
  root = root.replace(/(?:^|\/)(?:mobile|admin)\/+$/, '/');
  if (!root.endsWith('/')) root += '/';
  return `${origin}${root}data/jobs.json?t=${Date.now()}`;
}

let _jobsPromise = null;

export function loadJobs({ force = false } = {}) {
  if (_jobsPromise && !force) return _jobsPromise;
  _jobsPromise = (async () => {
    const { available } = await resolveApiBase({ force });
    if (available) {
      try {
        const res = await fetch(await apiUrl('/api/jobs'), { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch { /* fall through */ }
    }
    try {
      const res = await fetch(jobsJsonUrl(), { cache: 'no-store' });
      if (!res.ok) return emptyPayload();
      return res.json();
    } catch {
      return emptyPayload();
    }
  })();
  return _jobsPromise;
}

function emptyPayload() {
  return {
    meta: { sourceType: 'handshake-rss', feedUrl: '', feedTitle: '', totalJobs: 0 },
    jobs: [],
  };
}

export async function sendJobListEmail({ studentName, studentEmail, jobs }) {
  const hasApi = await isApiAvailable({ force: true });
  if (!hasApi) {
    const err = new Error('EMAIL_API_UNAVAILABLE');
    err.code = 'EMAIL_API_UNAVAILABLE';
    throw err;
  }

  const res = await fetch(await apiUrl('/api/jobs/send-list'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName, studentEmail, jobs }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: 'EMAIL_SEND_FAILED' };
  }

  if (!res.ok) {
    const err = new Error(data.error || 'EMAIL_SEND_FAILED');
    err.code = data.error || 'EMAIL_SEND_FAILED';
    throw err;
  }
  return data;
}
