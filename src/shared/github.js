// ─────────────────────────────────────────────────────────────────────────────
// GitHub API client (admin side)
//
// The admin dashboard uses this module to commit changes directly to the
// kiosk's repo — uploaded logos go into `assets/employers/...`, and the map
// URL is written to `config.json` at the repo root. Every kiosk / mobile
// instance reads from the same repo, so updates are propagated to all
// devices as soon as the commit lands.
//
// Auth: a GitHub Personal Access Token (fine-grained or classic) with
// "Contents: Read and write" on this repo. The token is stored in the
// browser's localStorage on the device running /admin, never committed.
// ─────────────────────────────────────────────────────────────────────────────

const CONNECTION_KEY = 'csun-kiosk-admin-gh';

// ─── Connection state ───────────────────────────────────────────────────────
export function getSavedConnection() {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    const conn = JSON.parse(raw);
    if (!conn.owner || !conn.repo || !conn.token) return null;
    return { branch: 'main', ...conn };
  } catch {
    return null;
  }
}

export function saveConnection(conn) {
  const clean = {
    owner:  String(conn.owner).trim(),
    repo:   String(conn.repo).trim(),
    branch: String(conn.branch || 'main').trim(),
    token:  String(conn.token).trim(),
  };
  if (!clean.owner || !clean.repo || !clean.token) {
    throw new Error('Owner, repo, and token are required.');
  }
  localStorage.setItem(CONNECTION_KEY, JSON.stringify(clean));
  return clean;
}

export function clearConnection() {
  localStorage.removeItem(CONNECTION_KEY);
}

export function inferRepoDefaults() {
  const host = window.location.hostname || '';
  const path = window.location.pathname || '';
  let owner = '';
  let repo  = '';

  if (host.endsWith('.github.io')) {
    owner = host.split('.')[0];
    const first = path.split('/').filter(Boolean)[0];
    if (first) repo = first;
    else if (owner) repo = `${owner}.github.io`;
  }
  return { owner, repo, branch: 'main', token: '' };
}

// ─── Low-level HTTP ─────────────────────────────────────────────────────────
const API = 'https://api.github.com';

function headers(token, extra = {}) {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Authorization': `Bearer ${token}`,
    ...extra,
  };
}

async function ghFetch(conn, path, init = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(conn.token), ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg;
    try {
      const body = await res.json();
      msg = body.message || JSON.stringify(body);
    } catch {
      msg = res.statusText;
    }
    const err = new Error(`GitHub ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Blob → base64 (chunked, handles large files) ───────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const result = reader.result || '';
      const i = result.indexOf(',');
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ─── Connection validation ──────────────────────────────────────────────────
// Hits /repos/{owner}/{repo} and verifies the branch exists. Returns the
// repo object with default_branch on success, throws a helpful error.
export async function validateConnection(conn) {
  const repo = await ghFetch(conn, `/repos/${conn.owner}/${conn.repo}`);
  if (!repo.permissions || (!repo.permissions.push && !repo.permissions.admin && !repo.permissions.maintain)) {
    throw new Error(
      'Connected, but this token does not have write access. ' +
      'The fine-grained token needs "Contents: Read and write" on this repo.',
    );
  }
  // Optional: confirm the branch exists (we don't throw if it doesn't; admin
  // may still want to create it via UI).
  try {
    await ghFetch(conn, `/repos/${conn.owner}/${conn.repo}/branches/${encodeURIComponent(conn.branch)}`);
  } catch (err) {
    if (err.status === 404) {
      throw new Error(`Branch "${conn.branch}" does not exist in ${conn.owner}/${conn.repo}.`);
    }
    throw err;
  }
  return repo;
}

// ─── Directory + file reads ─────────────────────────────────────────────────
// Returns [] for a missing directory instead of throwing, which matches the
// kiosk's behaviour before admin-edit was introduced.
export async function listDir(conn, dirPath) {
  const path = `/repos/${conn.owner}/${conn.repo}/contents/${encodeURI(dirPath)}?ref=${encodeURIComponent(conn.branch)}`;
  try {
    const out = await ghFetch(conn, path);
    if (!Array.isArray(out)) return [];
    return out;
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

export async function getFile(conn, filePath) {
  const path = `/repos/${conn.owner}/${conn.repo}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(conn.branch)}`;
  try {
    return await ghFetch(conn, path);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function getJsonFile(conn, filePath) {
  const file = await getFile(conn, filePath);
  if (!file || !file.content) return { data: null, sha: null, file: null };
  try {
    const text = base64ToUtf8(file.content.replace(/\n/g, ''));
    return { data: JSON.parse(text), sha: file.sha, file };
  } catch {
    return { data: null, sha: file.sha, file };
  }
}

// ─── File writes ────────────────────────────────────────────────────────────
export async function putBinaryFile(conn, { path, blob, message, sha }) {
  const content = await blobToBase64(blob);
  const body = { message, content, branch: conn.branch };
  if (sha) body.sha = sha;
  return ghFetch(conn, `/repos/${conn.owner}/${conn.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function putJsonFile(conn, { path, data, message, sha }) {
  const content = utf8ToBase64(JSON.stringify(data, null, 2) + '\n');
  const body = { message, content, branch: conn.branch };
  if (sha) body.sha = sha;
  return ghFetch(conn, `/repos/${conn.owner}/${conn.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFile(conn, { path, sha, message }) {
  return ghFetch(conn, `/repos/${conn.owner}/${conn.repo}/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: conn.branch }),
  });
}

// ─── Bulk delete (used by "remove all participating employers") ────────────
// GitHub's Contents API only supports one-file-at-a-time writes. For bulk
// operations we use the Git Data API — build a new tree without the targets
// and commit it in a single atomic commit. Also creates a `.gitkeep` so the
// folder survives the sweep.
export async function deleteFilesAtomically(conn, { paths, message, keepFolderPath }) {
  if (!paths.length) return null;
  const base = `/repos/${conn.owner}/${conn.repo}`;

  // Current HEAD of the branch
  const refInfo = await ghFetch(conn, `${base}/git/ref/heads/${encodeURIComponent(conn.branch)}`);
  const parentSha = refInfo.object.sha;
  const parentCommit = await ghFetch(conn, `${base}/git/commits/${parentSha}`);
  const baseTreeSha = parentCommit.tree.sha;

  // Build a tree with each path set to null (removal)
  const treeEntries = paths.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null }));

  // Add a .gitkeep so the folder still exists in the tree
  if (keepFolderPath) {
    const keepPath = `${keepFolderPath.replace(/\/+$/, '')}/.gitkeep`;
    treeEntries.push({ path: keepPath, mode: '100644', type: 'blob', content: '' });
  }

  const newTree = await ghFetch(conn, `${base}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const newCommit = await ghFetch(conn, `${base}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
  });

  await ghFetch(conn, `${base}/git/refs/heads/${encodeURIComponent(conn.branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return newCommit;
}

// ─── Helpers for uploads ────────────────────────────────────────────────────
export function sanitizeFilename(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'logo';
}

// Picks a non-colliding filename given a set of names already in the folder.
// `existing` can be a Set or an Array of strings.
export function uniqueFilename(desired, existing) {
  const set = existing instanceof Set ? existing : new Set(existing);
  if (!set.has(desired)) return desired;
  const dot = desired.lastIndexOf('.');
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext  = dot > 0 ? desired.slice(dot)    : '';
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!set.has(candidate)) return candidate;
  }
  // Fallback: epoch suffix
  return `${stem}-${Date.now()}${ext}`;
}

// Orchestrates uploading a batch of File objects into `dirPath`. Reports
// progress and handles filename collisions.
export async function uploadFiles(conn, {
  dirPath, files, messagePrefix = 'admin: upload logo', onProgress,
}) {
  // Pull current directory listing once so we can collision-detect
  const existing = await listDir(conn, dirPath);
  const existingNames = new Set(existing.map((e) => e.name));

  const results = [];
  let i = 0;
  for (const file of files) {
    const safe = uniqueFilename(sanitizeFilename(file.name), existingNames);
    const targetPath = `${dirPath.replace(/\/+$/, '')}/${safe}`;
    try {
      await putBinaryFile(conn, {
        path: targetPath,
        blob: file,
        message: `${messagePrefix} ${safe}`,
      });
      existingNames.add(safe);
      results.push({ ok: true, file: file.name, savedAs: safe });
    } catch (err) {
      results.push({ ok: false, file: file.name, error: err.message });
    }
    i += 1;
    if (typeof onProgress === 'function') onProgress(i, files.length, file);
  }
  return results;
}

// ─── Raw content URL ────────────────────────────────────────────────────────
// Same URL the Contents API returns as download_url, but with a cache-buster
// so kiosks pick up changes quickly.
export function rawUrl(conn, filePath, cacheBust = true) {
  const base = `https://raw.githubusercontent.com/${conn.owner}/${conn.repo}/${conn.branch}/${filePath.replace(/^\/+/, '')}`;
  return cacheBust ? `${base}?t=${Date.now()}` : base;
}
