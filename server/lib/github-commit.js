// Optional server-side GitHub commits for admin ad uploads (GITHUB_TOKEN env).

const API = 'https://api.github.com';

function githubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch };
}

function headers(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function ghFetch(cfg, path, init = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(cfg.token), ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.message || msg;
    } catch { /* ignore */ }
    const err = new Error(`GitHub ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function hasGithubCommitSupport() {
  return Boolean(githubConfig());
}

export async function getGithubJsonFile(filePath) {
  const cfg = githubConfig();
  if (!cfg) return { data: null, sha: null };

  const path = `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(cfg.branch)}`;
  try {
    const file = await ghFetch(cfg, path);
    if (!file?.content) return { data: null, sha: file?.sha || null };
    const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return { data: JSON.parse(text), sha: file.sha };
  } catch (err) {
    if (err.status === 404) return { data: null, sha: null };
    throw err;
  }
}

export async function commitGithubFiles({ files, message }) {
  const cfg = githubConfig();
  if (!cfg) throw new Error('GitHub commit is not configured on the server.');

  const base = `/repos/${cfg.owner}/${cfg.repo}`;
  const refInfo = await ghFetch(cfg, `${base}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const parentSha = refInfo.object.sha;
  const parentCommit = await ghFetch(cfg, `${base}/git/commits/${parentSha}`);
  const baseTreeSha = parentCommit.tree.sha;

  const treeEntries = [];
  for (const file of files) {
    const filePath = String(file.path).replace(/^\/+/, '');
    if (file.encoding === 'base64') {
      const blob = await ghFetch(cfg, `${base}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content, encoding: 'base64' }),
      });
      treeEntries.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      const text = typeof file.content === 'string'
        ? file.content
        : `${JSON.stringify(file.content, null, 2)}\n`;
      treeEntries.push({ path: filePath, mode: '100644', type: 'blob', content: text });
    }
  }

  const newTree = await ghFetch(cfg, `${base}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const newCommit = await ghFetch(cfg, `${base}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
  });

  await ghFetch(cfg, `${base}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return newCommit;
}

export async function deleteGithubFile(filePath, message) {
  const cfg = githubConfig();
  if (!cfg) throw new Error('GitHub commit is not configured on the server.');

  const path = `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(filePath)}`;
  const existing = await ghFetch(cfg, `${path}?ref=${encodeURIComponent(cfg.branch)}`);
  return ghFetch(cfg, path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha: existing.sha, branch: cfg.branch }),
  });
}
