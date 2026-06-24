// ─────────────────────────────────────────────────────────
// CSUN Kiosk — Admin dashboard
//
// All changes commit to the connected GitHub repo so every kiosk and
// mobile instance is updated in unison.
//
// Security note: this is a static site, so the password-gate is a
// deterrent, not real auth. The GitHub token lives in this browser's
// localStorage — not in source, not in the repo. Rotate/revoke anytime.
// ─────────────────────────────────────────────────────────

import { MAP_CONFIG } from '../src/config/map.js';
import {
  getSavedConnection, saveConnection, clearConnection, inferRepoDefaults,
  validateConnection,
  listDir, getFile, getJsonFile, putJsonFile, putBinaryFile, deleteFile, deleteFilesAtomically,
  commitJsonFilesAtomically,
  uploadFiles, rawUrl,
} from '../src/shared/github.js';
import {
  normalizeRssChannel,
  emptyJobsData,
  parseRssXmlInBrowser,
  formatJobDate,
} from '../src/shared/jobs-parser.js';
import { URL_CONFIG } from '../src/config/urls.js';
import { apiUrl, isApiAvailable, invalidateApiBaseCache } from '../src/shared/api-base.js';
import {
  emptyAdsData,
  validateAdFile,
  makeAdFilename,
  createAdId,
  formatFileSize,
  ADS_JSON_PATH,
  ADS_DIR,
} from '../src/shared/ads-constants.js';

// ─── Config ─────────────────────────────────────────────
const ADMIN_PASSWORD = 'career1';
const AUTH_KEY       = 'csun-kiosk-admin-auth';
const CONFIG_PATH    = 'config.json';
const JOBS_PATH      = 'data/jobs.json';
const JOBS_CONFIG_PATH = 'data/jobs-config.json';
const PARTNERS_DIR   = 'assets/employers/partners';
const ATTENDEES_DIR  = 'assets/employers/attendees';

// ─── DOM refs ───────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const loginShell   = $('login-shell');
const loginForm    = $('login-form');
const loginInput   = $('login-password');
const loginError   = $('login-error');

const connectShell = $('connect-shell');
const connectForm  = $('connect-form');
const connOwner    = $('conn-owner');
const connRepo     = $('conn-repo');
const connBranch   = $('conn-branch');
const connToken    = $('conn-token');
const connectBack  = $('connect-back');
const connectToast = $('connect-toast');

const dashboard    = $('dashboard');
const repoChip     = $('repo-chip');
const logoutBtn    = $('logout-btn');
const disconnectBtn = $('disconnect-btn');

const tabButtons   = document.querySelectorAll('.dash-tab');
const panels      = document.querySelectorAll('.dash-panel');

// Map tab
const mapForm            = $('map-form');
const mapInput           = $('map-url-input');
const mapHint            = $('map-url-current');
const mapResetBtn        = $('map-reset-btn');
const mapToast           = $('map-toast');
const mapPreviewFrame    = $('map-preview');
const mapPreviewRefresh  = $('map-preview-refresh');

// Sections
const sections = {
  partners: {
    kind: 'partners',
    label: 'Our Employer Partners',
    dirPath: PARTNERS_DIR,
    dropzone: $('partners-drop'),
    input:    $('partners-input'),
    progress: $('partners-progress'),
    fill:     $('partners-progress')?.querySelector('.upload-progress__fill'),
    plabel:   $('partners-progress')?.querySelector('.upload-progress__label'),
    grid:     $('partners-grid'),
    empty:    $('partners-empty'),
    count:    $('partners-count'),
    clearBtn: null,
    refreshBtn: $('partners-refresh'),
  },
  attendees: {
    kind: 'attendees',
    label: 'Participating Employers',
    dirPath: ATTENDEES_DIR,
    dropzone: $('attendees-drop'),
    input:    $('attendees-input'),
    progress: $('attendees-progress'),
    fill:     $('attendees-progress')?.querySelector('.upload-progress__fill'),
    plabel:   $('attendees-progress')?.querySelector('.upload-progress__label'),
    grid:     $('attendees-grid'),
    empty:    $('attendees-empty'),
    count:    $('attendees-count'),
    clearBtn: $('attendees-clear'),
    refreshBtn: $('attendees-refresh'),
  },
};

// Confirm modal
const confirmBackdrop = $('confirm-backdrop');
const confirmTitle    = $('confirm-title');
const confirmBody     = $('confirm-body');
const confirmOk       = $('confirm-ok');
const confirmCancel   = $('confirm-cancel');

// ─── Admin connection state ─────────────────────────────
let conn = null; // { owner, repo, branch, token }
let configState = { data: null, sha: null };
let jobsState = { data: null, sha: null };
let jobsConfigState = { data: null, sha: null };

// ─── Auth ───────────────────────────────────────────────
const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === '1';

function showLogin() {
  loginShell.classList.remove('is-hidden');
  connectShell.classList.add('is-hidden');
  dashboard.classList.add('is-hidden');
  loginInput.focus();
}

function showConnect() {
  loginShell.classList.add('is-hidden');
  connectShell.classList.remove('is-hidden');
  dashboard.classList.add('is-hidden');

  const defaults = inferRepoDefaults();
  if (!connOwner.value)  connOwner.value  = defaults.owner;
  if (!connRepo.value)   connRepo.value   = defaults.repo;
  if (!connBranch.value) connBranch.value = defaults.branch || 'main';
  (defaults.owner && defaults.repo ? connToken : connOwner).focus();
}

function showDashboard() {
  loginShell.classList.add('is-hidden');
  connectShell.classList.add('is-hidden');
  dashboard.classList.remove('is-hidden');
  repoChip.textContent = `${conn.owner}/${conn.repo} · ${conn.branch}`;
  initDashboard();
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (loginInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, '1');
    loginError.classList.add('is-hidden');
    routeAfterAuth();
  } else {
    loginError.classList.remove('is-hidden');
    loginInput.select();
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  loginInput.value = '';
  showLogin();
});

function routeAfterAuth() {
  const saved = getSavedConnection();
  if (saved) {
    conn = saved;
    showDashboard();
  } else {
    showConnect();
  }
}

// ─── Connect flow ───────────────────────────────────────
connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submit = $('connect-submit');
  submit.disabled = true;
  const prevText = submit.textContent;
  submit.textContent = 'Connecting…';
  connectToast.classList.add('is-hidden');

  try {
    const candidate = {
      owner:  connOwner.value.trim(),
      repo:   connRepo.value.trim(),
      branch: connBranch.value.trim() || 'main',
      token:  connToken.value.trim(),
    };
    await validateConnection(candidate);
    conn = saveConnection(candidate);
    showDashboard();
  } catch (err) {
    toast(connectToast, `Couldn't connect: ${err.message}`, 'error', 6000);
  } finally {
    submit.disabled = false;
    submit.textContent = prevText;
  }
});

connectBack.addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
});

disconnectBtn.addEventListener('click', async () => {
  const ok = await askConfirm({
    title: 'Disconnect this device from GitHub?',
    body:  'The saved token will be removed from this browser. Admin settings in the repo are not affected.',
    confirmLabel: 'Disconnect',
  });
  if (!ok) return;
  clearConnection();
  conn = null;
  showConnect();
});

// ─── Tabs ───────────────────────────────────────────────
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === btn.dataset.tab));
  });
});

// ─── Toasts ─────────────────────────────────────────────
function toast(el, msg, kind = 'success', ttl = 3600) {
  if (!el) return;
  el.className = `inline-toast inline-toast--${kind}`;
  el.textContent = msg;
  el.classList.remove('is-hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('is-hidden'), ttl);
}

// ─── Confirm ────────────────────────────────────────────
function askConfirm({ title, body, confirmLabel = 'Yes, do it' }) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmBody.textContent  = body;
    confirmOk.textContent    = confirmLabel;
    confirmBackdrop.classList.remove('is-hidden');
    const done = (ok) => {
      confirmBackdrop.classList.add('is-hidden');
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      confirmBackdrop.removeEventListener('click', onBackdrop);
      resolve(ok);
    };
    const onOk       = () => done(true);
    const onCancel   = () => done(false);
    const onBackdrop = (e) => { if (e.target === confirmBackdrop) done(false); };
    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
    confirmBackdrop.addEventListener('click', onBackdrop);
  });
}

// ─── Config helpers ─────────────────────────────────────
async function loadConfigFromRepo() {
  const { data, sha } = await getJsonFile(conn, CONFIG_PATH);
  configState = {
    data: data || { mapUrl: MAP_CONFIG.embedUrl, version: 0, updatedAt: null },
    sha,
  };
  return configState;
}

async function commitConfig({ mapUrl, apiBaseUrl, bumpVersion = true, message }) {
  const write = async () => {
    const current = configState.data || {};
    const next = {
      ...current,
      mapUrl: mapUrl ?? current.mapUrl ?? MAP_CONFIG.embedUrl,
      apiBaseUrl: apiBaseUrl !== undefined ? String(apiBaseUrl || '').trim() : (current.apiBaseUrl || ''),
      version: bumpVersion ? Number(current.version || 0) + 1 : Number(current.version || 0),
      updatedAt: new Date().toISOString(),
    };
    const result = await putJsonFile(conn, {
      path: CONFIG_PATH,
      data: next,
      message,
      sha: configState.sha,
    });
    configState = { data: next, sha: result.content?.sha || null };
    return next;
  };

  await loadConfigFromRepo();
  try {
    return await write();
  } catch (err) {
    // config.json changed on GitHub since we last read it (manual edit, another tab, etc.)
    if (err.status === 409) {
      await loadConfigFromRepo();
      return await write();
    }
    throw err;
  }
}

// ─── Map tab ────────────────────────────────────────────
async function loadMapTab() {
  try {
    await loadConfigFromRepo();
  } catch (err) {
    toast(mapToast, `Could not read config.json: ${err.message}`, 'error', 5000);
  }
  const current = configState.data?.mapUrl || MAP_CONFIG.embedUrl;
  mapInput.value = current;
  mapHint.textContent = configState.sha
    ? `Current value in ${conn.owner}/${conn.repo}/${CONFIG_PATH}`
    : `config.json will be created on first save (bundled default: ${MAP_CONFIG.embedUrl})`;
  refreshMapPreview();
}

function refreshMapPreview() {
  const url = (mapInput.value || '').trim() || MAP_CONFIG.embedUrl;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('embedded')) u.searchParams.set('embedded', 'true');
    mapPreviewFrame.src = u.toString();
  } catch {
    mapPreviewFrame.removeAttribute('src');
  }
}

mapForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = mapInput.value.trim();
  if (!val) return;
  try { new URL(val); } catch {
    toast(mapToast, 'That doesn\u2019t look like a valid URL.', 'error');
    return;
  }
  const submit = $('map-save-btn');
  const prev   = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Committing…';
  try {
    await commitConfig({ mapUrl: val, message: 'admin: update map URL' });
    toast(mapToast, 'Committed. Every kiosk and mobile page will pick this up on its next load.', 'success', 4200);
    mapHint.textContent = `Current value in ${conn.owner}/${conn.repo}/${CONFIG_PATH}`;
    refreshMapPreview();
  } catch (err) {
    toast(mapToast, `Commit failed: ${err.message}`, 'error', 6000);
  } finally {
    submit.disabled = false;
    submit.textContent = prev;
  }
});

mapResetBtn.addEventListener('click', async () => {
  const ok = await askConfirm({
    title: 'Reset the map URL to the bundled default?',
    body:  `This will commit "${MAP_CONFIG.embedUrl}" to config.json so every kiosk reverts to it.`,
    confirmLabel: 'Reset',
  });
  if (!ok) return;
  try {
    await commitConfig({ mapUrl: MAP_CONFIG.embedUrl, message: 'admin: reset map URL to default' });
    mapInput.value = MAP_CONFIG.embedUrl;
    toast(mapToast, 'Map URL reset.', 'info');
    refreshMapPreview();
  } catch (err) {
    toast(mapToast, `Commit failed: ${err.message}`, 'error', 6000);
  }
});

mapPreviewRefresh.addEventListener('click', refreshMapPreview);

// ─── Section rendering ──────────────────────────────────
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'avif', 'gif'];
function isImageFilename(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

function friendlyName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function renderSection(section) {
  const { kind, grid, empty, count, dirPath } = section;
  let items = [];
  try {
    const listing = await listDir(conn, dirPath);
    items = listing.filter((e) => e.type === 'file' && isImageFilename(e.name));
  } catch (err) {
    empty.classList.remove('is-hidden');
    empty.textContent = `Couldn't read ${dirPath}: ${err.message}`;
    count.textContent = '0 logos';
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = '';

  if (!items.length) {
    empty.classList.remove('is-hidden');
    empty.textContent = `Nothing in ${dirPath} yet. Drop images above to add them.`;
  } else {
    empty.classList.add('is-hidden');
  }

  count.textContent = `${items.length} ${items.length === 1 ? 'logo' : 'logos'}`;

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'logo-card';

    const preview = document.createElement('div');
    preview.className = 'logo-card__preview';
    const img = document.createElement('img');
    // Use the raw URL w/ cache buster so freshly-committed files actually show
    img.src = rawUrl(conn, item.path, true);
    img.alt = item.name;
    img.loading = 'lazy';
    preview.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'logo-card__meta';
    const name = document.createElement('div');
    name.className = 'logo-card__name';
    name.textContent = friendlyName(item.name);
    const sub = document.createElement('div');
    sub.className = 'logo-card__sub';
    sub.textContent = item.name;
    meta.append(name, sub);

    const rm = document.createElement('button');
    rm.className = 'logo-card__remove';
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.addEventListener('click', async () => {
      const ok = await askConfirm({
        title: 'Remove this logo?',
        body:  `This commits a deletion of ${item.path} to the repo. Every kiosk will stop showing it on its next load.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      rm.disabled = true;
      rm.textContent = 'Removing…';
      try {
        await deleteFile(conn, {
          path:    item.path,
          sha:     item.sha,
          message: `admin: remove ${item.path}`,
        });
        await commitConfig({ bumpVersion: true, message: 'admin: bump kiosk cache version' });
        await renderSection(section);
      } catch (err) {
        rm.disabled = false;
        rm.textContent = 'Remove';
        alert(`Delete failed: ${err.message}`);
      }
    });

    card.append(preview, meta, rm);
    grid.appendChild(card);
  });
}

// ─── Upload handling ────────────────────────────────────
function wireSection(section) {
  const { dropzone, input, progress, fill, plabel, refreshBtn, clearBtn } = section;
  if (!dropzone) return;

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); dropzone.classList.add('is-drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('is-drag');
    }),
  );
  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) handleUpload(section, files);
  });
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (files.length) handleUpload(section, files);
    input.value = '';
  });

  refreshBtn?.addEventListener('click', () => renderSection(section));

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const ok = await askConfirm({
        title: `Remove all ${section.label.toLowerCase()}?`,
        body:  `Every file in ${section.dirPath}/ will be deleted in one commit. A .gitkeep will be left so the folder remains.`,
        confirmLabel: 'Remove all',
      });
      if (!ok) return;
      clearBtn.disabled = true;
      const prev = clearBtn.textContent;
      clearBtn.textContent = 'Removing…';
      try {
        const listing = await listDir(conn, section.dirPath);
        const imagePaths = listing
          .filter((e) => e.type === 'file' && isImageFilename(e.name))
          .map((e) => e.path);
        if (!imagePaths.length) {
          clearBtn.disabled = false;
          clearBtn.textContent = prev;
          return;
        }
        await deleteFilesAtomically(conn, {
          paths: imagePaths,
          keepFolderPath: section.dirPath,
          message: `admin: bulk remove ${imagePaths.length} file(s) from ${section.dirPath}`,
        });
        await commitConfig({ bumpVersion: true, message: 'admin: bump kiosk cache version' });
        await renderSection(section);
      } catch (err) {
        alert(`Bulk delete failed: ${err.message}`);
      } finally {
        clearBtn.disabled = false;
        clearBtn.textContent = prev;
      }
    });
  }
}

async function handleUpload(section, files) {
  const { progress, fill, plabel, dirPath } = section;
  const imageFiles = files.filter((f) => f.type.startsWith('image/'));

  if (!imageFiles.length) {
    progress.classList.remove('is-hidden');
    fill.style.width = '0%';
    plabel.textContent = 'No image files detected. Try PNG, JPG, SVG or WebP.';
    setTimeout(() => progress.classList.add('is-hidden'), 2400);
    return;
  }

  progress.classList.remove('is-hidden');
  fill.style.width = '0%';
  plabel.textContent = `Committing 0 / ${imageFiles.length}…`;

  try {
    const results = await uploadFiles(conn, {
      dirPath, files: imageFiles, messagePrefix: `admin: add ${section.kind} logo`,
      onProgress: (done, total, file) => {
        fill.style.width = `${Math.round((done / total) * 100)}%`;
        plabel.textContent = `Committing ${done} / ${total} — ${file.name}`;
      },
    });
    const ok  = results.filter((r) => r.ok).length;
    const bad = results.length - ok;
    plabel.textContent = `Done — ${ok} committed${bad ? `, ${bad} failed` : ''}.`;
    setTimeout(() => progress.classList.add('is-hidden'), 1600);

    if (ok > 0) {
      await commitConfig({ bumpVersion: true, message: 'admin: bump kiosk cache version' });
    }
    await renderSection(section);
  } catch (err) {
    plabel.textContent = `Error: ${err.message}`;
    setTimeout(() => progress.classList.add('is-hidden'), 4000);
  }
}

// ─── Job Opportunities tab ──────────────────────────────
const jobsFeedUrl     = $('jobs-feed-url');
const jobsApiUrlInput = $('jobs-api-url');
const jobsApiSaveBtn  = $('jobs-api-save-btn');
const jobsApiHint     = $('jobs-api-hint');
const jobsFeedHint    = $('jobs-feed-hint');
const jobsConfigForm  = $('jobs-config-form');
const jobsSyncBtn     = $('jobs-sync-btn');
const jobsClearBtn    = $('jobs-clear-btn');
const jobsToast       = $('jobs-toast');
const jobsTotalCount  = $('jobs-total-count');
const jobsFeedTitle   = $('jobs-feed-title');
const jobsLastSynced  = $('jobs-last-synced');
const jobsPreviewBody = $('jobs-preview-body');

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Password': ADMIN_PASSWORD,
  };
}

async function apiAvailable() {
  return isApiAvailable({ force: true });
}

async function loadJobsFromRepo() {
  const [jobsFile, configFile] = await Promise.all([
    getJsonFile(conn, JOBS_PATH),
    getJsonFile(conn, JOBS_CONFIG_PATH),
  ]);
  jobsState = { data: jobsFile.data || emptyJobsData(), sha: jobsFile.sha };
  jobsConfigState = { data: configFile.data || { feedUrl: '', updatedAt: null }, sha: configFile.sha };
  return jobsState;
}

async function commitJobs(data, message) {
  const write = async () => {
    const result = await putJsonFile(conn, {
      path: JOBS_PATH,
      data,
      message,
      sha: jobsState.sha,
    });
    jobsState = { data, sha: result.content?.sha || null };
    return data;
  };

  await loadJobsFromRepo();
  try {
    return await write();
  } catch (err) {
    if (err.status === 409) {
      await loadJobsFromRepo();
      return await write();
    }
    throw err;
  }
}

async function commitJobsConfig(config, message) {
  const write = async () => {
    const result = await putJsonFile(conn, {
      path: JOBS_CONFIG_PATH,
      data: config,
      message,
      sha: jobsConfigState.sha,
    });
    jobsConfigState = { data: config, sha: result.content?.sha || null };
  };

  await loadJobsFromRepo();
  try {
    await write();
  } catch (err) {
    if (err.status === 409) {
      await loadJobsFromRepo();
      await write();
    } else {
      throw err;
    }
  }
}

function renderJobsPreview() {
  const data = jobsState.data || emptyJobsData();
  const jobs = data.jobs || [];
  const meta = data.meta || {};

  jobsTotalCount.textContent = String(meta.totalJobs ?? jobs.length);
  jobsFeedTitle.textContent = meta.feedTitle || '—';
  jobsLastSynced.textContent = meta.lastSyncedAt
    ? new Date(meta.lastSyncedAt).toLocaleString()
    : '—';

  if (!jobs.length) {
    jobsPreviewBody.innerHTML = '<tr><td colspan="5" class="jobs-admin-empty">No jobs synced yet.</td></tr>';
    return;
  }

  jobsPreviewBody.innerHTML = jobs.slice(0, 100).map((j) => `
    <tr>
      <td>${escHtml(j.displayTitle || j.title)}</td>
      <td>${escHtml(j.employer || '—')}</td>
      <td>${escHtml(formatJobDate(j.expiresAt) || '—')}</td>
      <td>${escHtml(formatJobDate(j.pubDate) || '—')}</td>
      <td>${j.applicationUrl ? `<a href="${escHtml(j.applicationUrl)}" target="_blank" rel="noopener">View</a>` : '—'}</td>
    </tr>`).join('');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadJobsTab() {
  try {
    await loadConfigFromRepo();
    await loadJobsFromRepo();
    const feedUrl = jobsConfigState.data?.feedUrl || jobsState.data?.meta?.feedUrl || '';
    jobsFeedUrl.value = feedUrl;
    if (jobsApiUrlInput) {
      jobsApiUrlInput.value = configState.data?.apiBaseUrl || '';
      jobsApiHint.textContent = configState.data?.apiBaseUrl
        ? `API URL in config.json — kiosk on GitHub Pages will call this server for email.`
        : `GitHub Pages cannot run Node. Deploy API on Vercel (vercel.json), then paste your Vercel URL here.`;
    }
    jobsFeedHint.textContent = jobsState.sha
      ? `Jobs data in ${conn.owner}/${conn.repo}/${JOBS_PATH}`
      : `${JOBS_PATH} will be created on first sync.`;
    renderJobsPreview();
  } catch (err) {
    toast(jobsToast, `Could not read jobs data: ${err.message}`, 'error', 6000);
  }
}

async function saveFeedUrl(feedUrl) {
  const config = { feedUrl, updatedAt: new Date().toISOString() };

  if (await apiAvailable()) {
    const res = await fetch(await apiUrl('/api/admin/jobs/config'), {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ feedUrl }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to save feed URL');
  }

  await loadJobsFromRepo();
  await commitJobsConfig(config, 'admin: save Handshake RSS feed URL');
  await loadJobsFromRepo();

  const jobs = jobsState.data
    ? { ...jobsState.data, meta: { ...jobsState.data.meta, feedUrl } }
    : emptyJobsData({ feedUrl });

  await commitJobs(jobs, 'admin: update jobs feed URL in meta');
}

async function fetchRssViaProxy(feedUrl) {
  let lastErr;
  for (const proxyFn of URL_CONFIG.corsProxies) {
    try {
      const proxyUrl = proxyFn(feedUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      const text = await res.text();
      if (text.trim()) return text;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(lastErr?.message || 'Could not fetch RSS feed through proxy.');
}

async function commitJobsSyncToRepo(feedUrl, data) {
  if (!Array.isArray(data.jobs)) {
    throw new Error('Sync returned no job list.');
  }

  const fullData = {
    meta: {
      sourceType: 'handshake-rss',
      feedUrl,
      feedTitle: data.meta?.feedTitle || '',
      feedDescription: data.meta?.feedDescription || '',
      channelLink: data.meta?.channelLink || '',
      lastSyncedAt: data.meta?.lastSyncedAt || new Date().toISOString(),
      clearedAt: '',
      totalJobs: data.jobs.length,
    },
    jobs: data.jobs,
  };

  const jobsConfig = { feedUrl, updatedAt: new Date().toISOString() };
  const message = `admin: sync ${fullData.jobs.length} job(s) from Handshake RSS`;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await loadJobsFromRepo();
      await loadConfigFromRepo();

      const nextConfig = {
        ...(configState.data || {}),
        mapUrl: configState.data?.mapUrl || MAP_CONFIG.embedUrl,
        apiBaseUrl: configState.data?.apiBaseUrl || '',
        version: Number(configState.data?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };

      await commitJsonFilesAtomically(conn, {
        message,
        files: [
          { path: JOBS_PATH, data: fullData },
          { path: JOBS_CONFIG_PATH, data: jobsConfig },
          { path: CONFIG_PATH, data: nextConfig },
        ],
      });

      jobsState = { data: fullData, sha: null };
      jobsConfigState = { data: jobsConfig, sha: null };
      configState = { data: nextConfig, sha: null };
      invalidateApiBaseCache();
      await loadJobsFromRepo();
      await loadConfigFromRepo();
      return fullData;
    } catch (err) {
      lastErr = err;
      if (err.status !== 409) throw err;
    }
  }
  throw lastErr || new Error('Could not commit sync to GitHub (conflict). Try again.');
}

async function syncJobsGitHub(feedUrl) {
  const xmlText = await fetchRssViaProxy(feedUrl);
  const channel = parseRssXmlInBrowser(xmlText);
  const data = normalizeRssChannel(channel, feedUrl);
  if (!data.jobs.length) {
    data.warnings = ['No job items were found in the feed.'];
  }
  const fullData = await commitJobsSyncToRepo(feedUrl, data);
  return {
    totalJobs: fullData.jobs.length,
    jobs: fullData.jobs,
    meta: fullData.meta,
    warnings: data.warnings || [],
    errors: data.errors || [],
  };
}

async function syncJobs(feedUrl) {
  if (await apiAvailable()) {
    const res = await fetch(await apiUrl('/api/admin/jobs/sync'), {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ feedUrl }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Sync failed');

    if (!Array.isArray(body.jobs)) {
      throw new Error(
        'The API did not return job data. Redeploy your Vercel project, then sync again.',
      );
    }

    const fullData = await commitJobsSyncToRepo(feedUrl, { meta: body.meta, jobs: body.jobs });
    return {
      totalJobs: fullData.jobs.length,
      jobs: fullData.jobs,
      meta: fullData.meta,
      errors: body.errors || [],
      warnings: body.warnings || [],
    };
  }
  return syncJobsGitHub(feedUrl);
}

async function clearJobsData() {
  let cleared;

  if (await apiAvailable()) {
    const res = await fetch(await apiUrl('/api/admin/jobs/clear'), {
      method: 'POST',
      headers: adminHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Clear failed');

    if (body.meta && Array.isArray(body.jobs)) {
      cleared = { meta: body.meta, jobs: body.jobs };
    } else {
      cleared = emptyJobsData({
        feedUrl: jobsConfigState.data?.feedUrl || jobsState.data?.meta?.feedUrl || '',
        feedTitle: jobsState.data?.meta?.feedTitle || '',
        feedDescription: jobsState.data?.meta?.feedDescription || '',
        channelLink: jobsState.data?.meta?.channelLink || '',
        lastSyncedAt: jobsState.data?.meta?.lastSyncedAt || '',
      });
    }
  } else {
    cleared = emptyJobsData({
      feedUrl: jobsConfigState.data?.feedUrl || jobsState.data?.meta?.feedUrl || '',
      feedTitle: jobsState.data?.meta?.feedTitle || '',
      feedDescription: jobsState.data?.meta?.feedDescription || '',
      channelLink: jobsState.data?.meta?.channelLink || '',
      lastSyncedAt: jobsState.data?.meta?.lastSyncedAt || '',
    });
  }

  await loadJobsFromRepo();
  await commitJobs(cleared, 'admin: clear job opportunities');
  await loadJobsFromRepo();
  await commitJobsConfig(
    { feedUrl: cleared.meta?.feedUrl || jobsConfigState.data?.feedUrl || '', updatedAt: new Date().toISOString() },
    'admin: clear job opportunities (keep feed URL)',
  );
  await commitConfig({ bumpVersion: true, message: 'admin: bump kiosk cache version after jobs clear' });
  return cleared;
}

function wireJobsTab() {
  if (!jobsConfigForm) return;

  jobsConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedUrl = jobsFeedUrl.value.trim();
    if (!feedUrl) {
      toast(jobsToast, 'Enter an RSS feed URL first.', 'error');
      return;
    }
    try { new URL(feedUrl); } catch {
      toast(jobsToast, 'That doesn\u2019t look like a valid URL.', 'error');
      return;
    }
    const btn = $('jobs-save-url-btn');
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Saving…';
    try {
      await saveFeedUrl(feedUrl);
      toast(jobsToast, 'Feed URL saved.', 'success');
      await loadJobsTab();
    } catch (err) {
      toast(jobsToast, err.message, 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  jobsSyncBtn?.addEventListener('click', async () => {
    const feedUrl = jobsFeedUrl.value.trim()
      || jobsConfigState.data?.feedUrl
      || jobsState.data?.meta?.feedUrl;
    if (!feedUrl) {
      toast(jobsToast, 'Save an RSS feed URL before syncing.', 'error');
      return;
    }
    jobsSyncBtn.disabled = true;
    const prev = jobsSyncBtn.textContent;
    jobsSyncBtn.textContent = 'Syncing…';
    try {
      const result = await syncJobs(feedUrl);
      const total = result.jobs?.length ?? result.totalJobs ?? 0;
      const warnings = result.errors || result.warnings || [];
      toast(
        jobsToast,
        warnings.length
          ? `Synced ${total} job(s) to GitHub with warnings: ${warnings.join(' ')}`
          : `Synced ${total} job(s) to GitHub. Kiosks will pick them up on reload.`,
        warnings.length ? 'info' : 'success',
        5000,
      );
      await loadJobsTab();
    } catch (err) {
      toast(jobsToast, `Sync failed: ${err.message}`, 'error', 8000);
    } finally {
      jobsSyncBtn.disabled = false;
      jobsSyncBtn.textContent = prev;
    }
  });

  jobsClearBtn?.addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Clear all job opportunities?',
      body: 'This empties the jobs list for students after the career fair. The saved RSS feed URL will be kept.',
      confirmLabel: 'Clear jobs',
    });
    if (!ok) return;
    jobsClearBtn.disabled = true;
    const prev = jobsClearBtn.textContent;
    jobsClearBtn.textContent = 'Clearing…';
    try {
      await clearJobsData();
      toast(jobsToast, 'Job opportunities cleared.', 'success');
      await loadJobsTab();
    } catch (err) {
      toast(jobsToast, `Clear failed: ${err.message}`, 'error', 6000);
    } finally {
      jobsClearBtn.disabled = false;
      jobsClearBtn.textContent = prev;
    }
  });

  jobsApiSaveBtn?.addEventListener('click', async () => {
    const val = (jobsApiUrlInput?.value || '').trim().replace(/\/+$/, '');
    if (val) {
      try { new URL(val); } catch {
        toast(jobsToast, 'That doesn\u2019t look like a valid API URL.', 'error');
        return;
      }
    }
    jobsApiSaveBtn.disabled = true;
    const prev = jobsApiSaveBtn.textContent;
    jobsApiSaveBtn.textContent = 'Saving…';
    try {
      await commitConfig({
        apiBaseUrl: val,
        message: val ? `admin: set API server URL to ${val}` : 'admin: clear API server URL',
      });
      invalidateApiBaseCache();
      toast(jobsToast, val
        ? 'API URL saved to config.json. Email and sync will use this server.'
        : 'API URL cleared from config.json.', 'success', 5000);
      await loadJobsTab();
    } catch (err) {
      toast(jobsToast, `Could not save API URL: ${err.message}`, 'error', 6000);
    } finally {
      jobsApiSaveBtn.disabled = false;
      jobsApiSaveBtn.textContent = prev;
    }
  });

  const jobsEmailTestForm = $('jobs-email-test-form');
  const jobsEmailTestToast = $('jobs-email-test-toast');

  jobsEmailTestForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const testEmail = $('jobs-test-email')?.value?.trim();
    const testName = $('jobs-test-name')?.value?.trim() || '';
    if (!testEmail) {
      toast(jobsEmailTestToast, 'Enter a test email address.', 'error');
      return;
    }

    const btn = $('jobs-test-send-btn');
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Sending…';
    jobsEmailTestToast.classList.add('is-hidden');

    try {
      if (!(await apiAvailable())) {
        throw new Error(
          'API server is not reachable. Deploy the API on Vercel (see vercel.json in the repo), ' +
          'then save your Vercel URL below as the API server URL in config.json.',
        );
      }
      const res = await fetch(await apiUrl('/api/admin/jobs/test-email'), {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ testEmail, testName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Test email failed.');
      toast(jobsEmailTestToast, 'Test email sent successfully. Brevo is connected.', 'success', 5000);
    } catch (err) {
      const msg = err.message?.includes('not reachable') || err.message?.includes('not configured')
        ? err.message
        : 'Test email could not be sent. Check the Brevo API key, sender email, and server logs.';
      toast(jobsEmailTestToast, msg, 'error', 8000);
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

// ─── Kiosk Ads tab ──────────────────────────────────────
const adsUploadForm     = $('ads-upload-form');
const adsTitleInput     = $('ads-title-input');
const adsFileInput      = $('ads-file-input');
const adsStartDate      = $('ads-start-date');
const adsEndDate        = $('ads-end-date');
const adsActiveInput    = $('ads-active-input');
const adsUploadBtn      = $('ads-upload-btn');
const adsUploadProgress = $('ads-upload-progress');
const adsUploadFill     = adsUploadProgress?.querySelector('.upload-progress__fill');
const adsUploadLabel    = adsUploadProgress?.querySelector('.upload-progress__label');
const adsToast          = $('ads-toast');
const adsTableBody      = $('ads-table-body');
const adsTotalCount     = $('ads-total-count');
const adsActiveCount    = $('ads-active-count');
const adsTestIdleBtn    = $('ads-test-idle-btn');
const adsTestStatus     = $('ads-test-status');
const adsPreviewBackdrop = $('ads-preview-backdrop');
const adsPreviewMedia   = $('ads-preview-media');
const adsPreviewTitle   = $('ads-preview-title');
const adsPreviewClose   = $('ads-preview-close');

let adsState = { data: emptyAdsData(), sha: null };

async function loadAdsFromRepo() {
  const file = await getJsonFile(conn, ADS_JSON_PATH);
  adsState = { data: file.data || emptyAdsData(), sha: file.sha };
  return adsState;
}

async function commitAds(data, message) {
  const write = async () => {
    const bumped = await bumpConfigForAds();
    await commitJsonFilesAtomically(conn, {
      message,
      files: [
        { path: ADS_JSON_PATH, data },
        { path: CONFIG_PATH, data: bumped },
      ],
    });
    adsState = { data, sha: null };
    configState = { data: bumped, sha: null };
  };

  await loadAdsFromRepo();
  try {
    await write();
  } catch (err) {
    if (err.status === 409) {
      await loadAdsFromRepo();
      await write();
    } else {
      throw err;
    }
  }
}

async function bumpConfigForAds() {
  await loadConfigFromRepo();
  const current = configState.data || {};
  return {
    ...current,
    mapUrl: current.mapUrl || MAP_CONFIG.embedUrl,
    apiBaseUrl: current.apiBaseUrl || '',
    version: Number(current.version || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

function adPreviewUrl(ad) {
  const src = ad.thumbnailSrc || ad.src;
  if (!src) return '';
  return rawUrl(conn, src.replace(/^\//, ''), true);
}

function adMediaUrl(ad) {
  if (!ad?.src) return '';
  return rawUrl(conn, ad.src.replace(/^\//, ''), true);
}

function renderAdsTable() {
  const data = adsState.data || emptyAdsData();
  const ads = [...(data.ads || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const now = new Date();

  const activeN = ads.filter((ad) => {
    if (!ad.active) return false;
    if (ad.startDate && new Date(ad.startDate) > now) return false;
    if (ad.endDate) {
      const end = new Date(ad.endDate);
      end.setHours(23, 59, 59, 999);
      if (end < now) return false;
    }
    return true;
  }).length;

  if (adsTotalCount) adsTotalCount.textContent = `${ads.length} ad${ads.length === 1 ? '' : 's'}`;
  if (adsActiveCount) adsActiveCount.textContent = `${activeN} active`;
  if (adsTestStatus) {
    const at = data.meta?.testIdleAdsAt;
    adsTestStatus.textContent = at
      ? `Last test signal: ${new Date(at).toLocaleString()}`
      : 'No test signal sent yet.';
  }
  if (adsTestIdleBtn) {
    adsTestIdleBtn.disabled = activeN === 0;
    adsTestIdleBtn.title = activeN === 0
      ? 'Upload at least one active ad first.'
      : 'Force all kiosks to enter idle ad mode within ~15 seconds.';
  }

  if (!ads.length) {
    adsTableBody.innerHTML = '<tr><td colspan="8" class="jobs-admin-empty">No ads uploaded yet. Upload a vertical video or image to start showing idle kiosk ads.</td></tr>';
    return;
  }

  adsTableBody.innerHTML = ads.map((ad, index) => {
    const schedule = [ad.startDate, ad.endDate].filter(Boolean).join(' → ') || '—';
    const thumb = ad.type === 'video'
      ? `<div class="ads-thumb ads-thumb--video">▶</div>`
      : `<img class="ads-thumb" src="${escHtml(adPreviewUrl(ad))}" alt="" loading="lazy" />`;
    return `
      <tr data-ad-id="${escHtml(ad.id)}">
        <td>${thumb}</td>
        <td><input type="text" class="ads-title-edit field__input" value="${escHtml(ad.title)}" data-ad-title="${escHtml(ad.id)}" /></td>
        <td>${escHtml(ad.type)}</td>
        <td><button type="button" class="btn btn--ghost btn--sm ads-toggle-active" data-ad-id="${escHtml(ad.id)}">${ad.active ? 'Active' : 'Inactive'}</button></td>
        <td>${ad.uploadedAt ? new Date(ad.uploadedAt).toLocaleString() : '—'}</td>
        <td>
          <div class="ads-date-row">
            <input type="date" class="field__input ads-date-start" data-ad-id="${escHtml(ad.id)}" value="${escHtml(ad.startDate || '')}" />
            <input type="date" class="field__input ads-date-end" data-ad-id="${escHtml(ad.id)}" value="${escHtml(ad.endDate || '')}" />
          </div>
        </td>
        <td>${escHtml(formatFileSize(ad.fileSize))}</td>
        <td class="ads-actions">
          <button type="button" class="btn btn--ghost btn--sm ads-preview-btn" data-ad-id="${escHtml(ad.id)}">Preview</button>
          <button type="button" class="btn btn--ghost btn--sm ads-move-up" data-ad-id="${escHtml(ad.id)}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn--ghost btn--sm ads-move-down" data-ad-id="${escHtml(ad.id)}" ${index === ads.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn btn--danger btn--sm ads-delete-btn" data-ad-id="${escHtml(ad.id)}">Delete</button>
        </td>
      </tr>`;
  }).join('');

  adsTableBody.querySelectorAll('.ads-toggle-active').forEach((btn) => {
    btn.addEventListener('click', () => toggleAdActive(btn.dataset.adId));
  });
  adsTableBody.querySelectorAll('.ads-preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => previewAd(btn.dataset.adId));
  });
  adsTableBody.querySelectorAll('.ads-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteAd(btn.dataset.adId));
  });
  adsTableBody.querySelectorAll('.ads-move-up').forEach((btn) => {
    btn.addEventListener('click', () => moveAd(btn.dataset.adId, -1));
  });
  adsTableBody.querySelectorAll('.ads-move-down').forEach((btn) => {
    btn.addEventListener('click', () => moveAd(btn.dataset.adId, 1));
  });
  adsTableBody.querySelectorAll('.ads-title-edit').forEach((input) => {
    input.addEventListener('change', () => updateAdField(input.dataset.adTitle, { title: input.value }));
  });
  adsTableBody.querySelectorAll('.ads-date-start').forEach((input) => {
    input.addEventListener('change', () => updateAdField(input.dataset.adId, { startDate: input.value }));
  });
  adsTableBody.querySelectorAll('.ads-date-end').forEach((input) => {
    input.addEventListener('change', () => updateAdField(input.dataset.adId, { endDate: input.value }));
  });
}

function getAdById(id) {
  return (adsState.data?.ads || []).find((ad) => ad.id === id) || null;
}

async function updateAdField(id, patch) {
  const data = { ...adsState.data, ads: [...(adsState.data.ads || [])] };
  const ad = data.ads.find((a) => a.id === id);
  if (!ad) return;
  Object.assign(ad, patch, { updatedAt: new Date().toISOString() });
  try {
    await commitAds(data, `admin: update kiosk ad ${id}`);
    toast(adsToast, 'Ad updated.', 'success');
    await loadAdsTab();
  } catch (err) {
    toast(adsToast, err.message, 'error', 6000);
  }
}

async function toggleAdActive(id) {
  const ad = getAdById(id);
  if (!ad) return;
  await updateAdField(id, { active: !ad.active });
}

async function moveAd(id, delta) {
  const data = { ...adsState.data, ads: [...(adsState.data.ads || [])] };
  const sorted = data.ads.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = sorted.findIndex((a) => a.id === id);
  const swap = idx + delta;
  if (idx < 0 || swap < 0 || swap >= sorted.length) return;
  const aOrder = sorted[idx].order ?? idx;
  sorted[idx].order = sorted[swap].order ?? swap;
  sorted[swap].order = aOrder;
  data.ads = sorted;
  try {
    await commitAds(data, `admin: reorder kiosk ads`);
    await loadAdsTab();
  } catch (err) {
    toast(adsToast, err.message, 'error', 6000);
  }
}

function previewAd(id) {
  const ad = getAdById(id);
  if (!ad || !adsPreviewBackdrop) return;
  adsPreviewTitle.textContent = ad.title || 'Ad preview';
  adsPreviewMedia.innerHTML = '';
  const url = adMediaUrl(ad);
  if (ad.type === 'video') {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    adsPreviewMedia.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.alt = ad.title || '';
    adsPreviewMedia.appendChild(img);
  }
  adsPreviewBackdrop.classList.remove('is-hidden');
}

function closeAdsPreview() {
  if (!adsPreviewBackdrop) return;
  adsPreviewBackdrop.classList.add('is-hidden');
  if (adsPreviewMedia) adsPreviewMedia.innerHTML = '';
}

adsPreviewClose?.addEventListener('click', closeAdsPreview);
adsPreviewBackdrop?.addEventListener('click', (e) => {
  if (e.target === adsPreviewBackdrop) closeAdsPreview();
});

async function deleteAd(id) {
  const ad = getAdById(id);
  if (!ad) return;
  const ok = await askConfirm({
    title: 'Delete this ad?',
    body: 'The ad will be removed from the kiosk playlist. The media file will be deleted from the repo.',
    confirmLabel: 'Delete',
  });
  if (!ok) return;

  try {
    if (ad.fileName) {
      const file = await getFile(conn, `${ADS_DIR}/${ad.fileName}`);
      if (file?.sha) {
        await deleteFile(conn, {
          path: `${ADS_DIR}/${ad.fileName}`,
          sha: file.sha,
          message: `admin: delete kiosk ad media ${ad.fileName}`,
        });
      }
    }
    const next = {
      ...adsState.data,
      ads: (adsState.data.ads || []).filter((a) => a.id !== id),
    };
    next.meta = {
      ...next.meta,
      lastUpdatedAt: new Date().toISOString(),
      totalAds: next.ads.length,
    };
    await commitAds(next, `admin: remove kiosk ad ${id}`);
    toast(adsToast, 'Ad deleted.', 'success');
    await loadAdsTab();
  } catch (err) {
    toast(adsToast, err.message, 'error', 6000);
  }
}

async function handleAdsUpload(e) {
  e.preventDefault();
  const file = adsFileInput?.files?.[0];
  const title = adsTitleInput?.value?.trim() || '';
  if (!file) {
    toast(adsToast, 'Choose a file to upload.', 'error');
    return;
  }

  const validation = validateAdFile(file);
  if (!validation.ok) {
    toast(adsToast, validation.error, 'error', 6000);
    return;
  }

  const prev = adsUploadBtn?.textContent;
  if (adsUploadBtn) { adsUploadBtn.disabled = true; adsUploadBtn.textContent = 'Uploading…'; }
  adsUploadProgress?.classList.remove('is-hidden');
  if (adsUploadFill) adsUploadFill.style.width = '10%';
  if (adsUploadLabel) adsUploadLabel.textContent = 'Uploading media…';

  try {
    const safeName = makeAdFilename(title, file.name);
    const targetPath = `${ADS_DIR}/${safeName}`;
    await putBinaryFile(conn, {
      path: targetPath,
      blob: file,
      message: `admin: upload kiosk ad ${safeName}`,
    });
    if (adsUploadFill) adsUploadFill.style.width = '70%';
    if (adsUploadLabel) adsUploadLabel.textContent = 'Saving metadata…';

    await loadAdsFromRepo();
    const data = adsState.data || emptyAdsData();
    const maxOrder = (data.ads || []).reduce((m, ad) => Math.max(m, ad.order ?? 0), -1);
    const now = new Date().toISOString();
    const record = {
      id: createAdId(),
      title: title || file.name,
      type: validation.type,
      src: `/${ADS_DIR}/${safeName}`,
      thumbnailSrc: validation.type === 'image' ? `/${ADS_DIR}/${safeName}` : '',
      fileName: safeName,
      fileSize: file.size,
      mimeType: file.type,
      active: adsActiveInput?.checked !== false,
      startDate: adsStartDate?.value || '',
      endDate: adsEndDate?.value || '',
      durationSeconds: null,
      uploadedAt: now,
      updatedAt: now,
      order: maxOrder + 1,
    };

    const next = {
      ...data,
      ads: [...(data.ads || []), record],
    };
    next.meta = {
      ...next.meta,
      lastUpdatedAt: now,
      totalAds: next.ads.length,
    };

    await commitAds(next, `admin: add kiosk ad ${record.id}`);
    if (adsUploadFill) adsUploadFill.style.width = '100%';
    if (adsUploadLabel) adsUploadLabel.textContent = 'Done.';
    toast(adsToast, 'Ad uploaded successfully.', 'success');
    adsUploadForm?.reset();
    if (adsActiveInput) adsActiveInput.checked = true;
    await loadAdsTab();
  } catch (err) {
    toast(adsToast, 'Ad upload failed. Please check the file type, file size, and try again.', 'error', 8000);
    if (adsUploadLabel) adsUploadLabel.textContent = err.message;
  } finally {
    if (adsUploadBtn) { adsUploadBtn.disabled = false; adsUploadBtn.textContent = prev; }
    setTimeout(() => adsUploadProgress?.classList.add('is-hidden'), 1600);
  }
}

async function loadAdsTab() {
  try {
    await loadAdsFromRepo();
    renderAdsTable();
  } catch (err) {
    toast(adsToast, `Could not load ads: ${err.message}`, 'error', 6000);
  }
}

async function triggerTestIdleAdsOnAllKiosks() {
  const activeN = (adsState.data?.ads || []).filter((ad) => ad.active).length;
  if (!activeN) {
    toast(adsToast, 'Upload at least one active ad before testing.', 'error', 5000);
    return;
  }

  const prev = adsTestIdleBtn?.textContent;
  if (adsTestIdleBtn) {
    adsTestIdleBtn.disabled = true;
    adsTestIdleBtn.textContent = 'Sending…';
  }

  try {
    await loadAdsFromRepo();
    const data = adsState.data || emptyAdsData();
    const now = new Date().toISOString();
    data.meta = {
      ...data.meta,
      testIdleAdsAt: now,
      lastUpdatedAt: now,
    };
    await commitAds(data, 'admin: trigger idle ad test on all kiosks');
    toast(
      adsToast,
      'Test signal sent. Active kiosks should start ads within about 15 seconds.',
      'success',
      6000,
    );
    await loadAdsTab();
  } catch (err) {
    toast(adsToast, err.message || 'Could not send test signal.', 'error', 6000);
  } finally {
    if (adsTestIdleBtn) {
      adsTestIdleBtn.textContent = prev;
    }
  }
}

function wireAdsTab() {
  adsUploadForm?.addEventListener('submit', handleAdsUpload);
  adsTestIdleBtn?.addEventListener('click', triggerTestIdleAdsOnAllKiosks);
}

// ─── Dashboard init ─────────────────────────────────────
async function initDashboard() {
  wireSection(sections.partners);
  wireSection(sections.attendees);
  wireJobsTab();
  wireAdsTab();
  await loadMapTab();
  await Promise.all([
    renderSection(sections.partners),
    renderSection(sections.attendees),
    loadJobsTab(),
    loadAdsTab(),
  ]);
}

// ─── Boot ───────────────────────────────────────────────
if (isAuthed()) routeAfterAuth();
else showLogin();
