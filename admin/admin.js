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
  listDir, getJsonFile, putJsonFile, deleteFile, deleteFilesAtomically,
  uploadFiles, rawUrl,
} from '../src/shared/github.js';

// ─── Config ─────────────────────────────────────────────
const ADMIN_PASSWORD = 'spider#5';
const AUTH_KEY       = 'csun-kiosk-admin-auth';
const CONFIG_PATH    = 'config.json';
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

async function commitConfig({ mapUrl, bumpVersion = true, message }) {
  const current = configState.data || {};
  const next = {
    ...current,
    mapUrl: mapUrl ?? current.mapUrl ?? MAP_CONFIG.embedUrl,
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

// ─── Dashboard init ─────────────────────────────────────
async function initDashboard() {
  wireSection(sections.partners);
  wireSection(sections.attendees);
  await loadMapTab();
  await Promise.all([
    renderSection(sections.partners),
    renderSection(sections.attendees),
  ]);
}

// ─── Boot ───────────────────────────────────────────────
if (isAuthed()) routeAfterAuth();
else showLogin();
