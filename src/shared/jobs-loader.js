// ─────────────────────────────────────────────────────────────────────────────
// Runtime jobs data loader (kiosk)
// Reads from the API when a server is running, otherwise from data/jobs.json.
// Never fetches Handshake RSS directly.
// ─────────────────────────────────────────────────────────────────────────────

export { formatJobDate } from './jobs-parser.js';

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
    try {
      const apiRes = await fetch('/api/jobs', { cache: 'no-store' });
      if (apiRes.ok) return apiRes.json();
    } catch {
      // API not available — fall back to static JSON (GitHub Pages)
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
  const res = await fetch('/api/jobs/send-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName, studentEmail, jobs }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Email request failed');
  }
  return data;
}
