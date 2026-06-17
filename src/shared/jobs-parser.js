// ─────────────────────────────────────────────────────────────────────────────
// Handshake RSS → normalized job records
// Shared by the API server and the admin GitHub-commit sync fallback.
// ─────────────────────────────────────────────────────────────────────────────

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&#8217;': "'", '&#8216;': "'", '&#8220;': '"', '&#8221;': '"',
};

export function decodeEntities(str) {
  if (!str || typeof str !== 'string') return '';
  let out = str;
  for (const [entity, ch] of Object.entries(HTML_ENTITIES)) {
    out = out.split(entity).join(ch);
  }
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return out;
}

export function stripHtml(html) {
  if (!html) return '';
  const text = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return decodeEntities(text);
}

export function stripHtmlCompact(html) {
  return stripHtml(html).replace(/\s+/g, ' ').trim();
}

export function sanitizeDescriptionHtml(html) {
  if (!html) return '';
  const decoded = decodeEntities(String(html));
  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<br\s*\/?>/gi, '<br>')
    .trim();
}

function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function textVal(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if ('#text' in val) return String(val['#text'] ?? '');
    if ('_text' in val) return String(val._text ?? '');
  }
  return String(val);
}

function attrVal(node, key) {
  if (!node || typeof node !== 'object') return '';
  const direct = node[`@${key}`] ?? node[key];
  return textVal(direct);
}

export function extractJobId(guid, link) {
  const g = String(guid || '');
  const m = g.match(/\/Job\/(\d+)/i) || g.match(/(\d{5,})/);
  if (m) return m[1];
  const l = String(link || '');
  const lm = l.match(/\/jobs\/(\d+)/i);
  if (lm) return lm[1];
  return g || l || `job-${Date.now()}`;
}

export function splitTitle(displayTitle) {
  const title = String(displayTitle || '').trim();
  const atMatch = title.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return {
      title: atMatch[1].trim(),
      employer: atMatch[2].trim(),
      displayTitle: title,
    };
  }
  return { title, employer: '', displayTitle: title };
}

function parseUsDate(str) {
  if (!str) return '';
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function extractField(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractPayRange(text) {
  const patterns = [
    /Pay\s*Range\s*(?:is\s*)?(\$[\d,.]+(?:\s*[-–]\s*\$[\d,.]+)?(?:\s*(?:an?\s+)?(?:hour|year|yr))?)/i,
    /(\$[\d,.]+(?:\s*[-–]\s*\$[\d,.]+)?\s*(?:per\s+hour|an?\s+hour|a\s+year))/i,
    /(\$[\d,.]+\s*[-–]\s*\$[\d,.]+)/,
  ];
  return extractField(text, patterns);
}

function extractQualifications(text) {
  const section = text.match(/Qualifications?:?\s*([\s\S]*?)(?:\n\n|Benefits?:|Application|$)/i);
  if (!section) return [];
  return section[1]
    .split(/\n|•|·|–|-(?=\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 200)
    .slice(0, 8);
}

function extractTags(text, feedTitle) {
  const tags = [];
  if (feedTitle) tags.push(feedTitle);
  const industry = extractField(text, [/Industry:?\s*(.+?)(?:\n|$)/i]);
  if (industry) tags.push(industry);
  return [...new Set(tags.filter(Boolean))];
}

function truncateSummary(text, maxLen = 280) {
  let clean = String(text || '')
    .replace(/^Employer:\s*.+?(?:\n|$)/im, '')
    .replace(/^Expires:\s*.+?(?:\n|$)/im, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).replace(/\s+\S*$/, '')}…`;
}

export function normalizeRssItem(item, channelMeta = {}) {
  const rawTitle = decodeEntities(textVal(item.title));
  const rawDescription = textVal(item.description);
  const guid = textVal(item.guid) || attrVal(item.guid, 'isPermaLink') || '';
  const link = textVal(item.link);
  const pubDateRaw = textVal(item.pubDate);
  const sourceUrl = textVal(item.source?.url ?? item.source) || attrVal(item.source, 'url');

  const descriptionText = stripHtml(rawDescription);
  const descriptionSearch = stripHtmlCompact(rawDescription);
  const { title, employer: titleEmployer, displayTitle } = splitTitle(rawTitle);

  const employerFromDesc = extractField(descriptionText, [
    /^Employer:\s*(.+?)(?:\n|$)/im,
    /\bEmployer:\s*(.+?)(?:\n|$)/i,
  ]);
  const employer = employerFromDesc || titleEmployer;

  const expiresRaw = extractField(descriptionText, [
    /^Expires:\s*(\d{1,2}\/\d{1,2}\/\d{4})/im,
    /\bExpires:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /\bExpiration(?:\s+Date)?:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ]);

  const location = extractField(descriptionText, [
    /^Location:\s*(.+?)(?:\n|$)/im,
    /\bLocation:\s*(.+?)(?:\n|$)/i,
  ]);

  const jobType = extractField(descriptionText, [
    /^Job\s*Type:\s*(.+?)(?:\n|$)/im,
    /\bJob\s*Type:\s*(.+?)(?:\n|$)/i,
    /\b(Full[- ]time|Part[- ]time|Internship|Contract|Temporary|Remote)\b/i,
  ]);

  const schedule = extractField(descriptionText, [
    /^Schedule:\s*(.+?)(?:\n|$)/im,
    /\bSchedule:\s*(.+?)(?:\n|$)/i,
  ]);

  const industry = extractField(descriptionText, [
    /^Industry:\s*(.+?)(?:\n|$)/im,
    /\bIndustry:\s*(.+?)(?:\n|$)/i,
  ]);

  const payRange = extractPayRange(descriptionText);
  const qualifications = extractQualifications(descriptionText);
  const tags = extractTags(descriptionText, channelMeta.feedTitle);

  let pubDate = '';
  if (pubDateRaw) {
    const d = new Date(pubDateRaw);
    pubDate = Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  const id = extractJobId(guid, link);

  const raw = {
    title: rawTitle,
    description: rawDescription,
    guid,
    pubDate: pubDateRaw,
    link,
    sourceUrl,
  };

  return {
    id,
    guid: guid || `gid://handshake/Job/${id}`,
    title: title || rawTitle,
    employer,
    displayTitle: displayTitle || rawTitle,
    description: sanitizeDescriptionHtml(rawDescription),
    descriptionText: descriptionSearch,
    summary: truncateSummary(descriptionSearch),
    expiresAt: parseUsDate(expiresRaw),
    pubDate,
    applicationUrl: link,
    sourceUrl,
    location,
    payRange,
    schedule,
    jobType,
    industry,
    feedTitle: channelMeta.feedTitle || '',
    qualifications,
    tags,
    raw,
  };
}

export function dedupeJobs(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    const key = job.id || job.guid || job.applicationUrl;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

export function normalizeRssChannel(channel, feedUrl = '') {
  const feedTitle = decodeEntities(textVal(channel?.title));
  const feedDescription = decodeEntities(textVal(channel?.description));
  const channelLink = textVal(channel?.link);
  const channelMeta = { feedTitle, feedDescription, channelLink, feedUrl };

  const items = toArray(channel?.item).map((item) => normalizeRssItem(item, channelMeta));
  const jobs = dedupeJobs(items);

  return {
    meta: {
      sourceType: 'handshake-rss',
      feedUrl,
      feedTitle,
      feedDescription,
      channelLink,
      lastSyncedAt: new Date().toISOString(),
      clearedAt: '',
      totalJobs: jobs.length,
    },
    jobs,
  };
}

export function emptyJobsData(preserveMeta = {}) {
  return {
    meta: {
      sourceType: 'handshake-rss',
      feedUrl: preserveMeta.feedUrl || '',
      feedTitle: preserveMeta.feedTitle || '',
      feedDescription: preserveMeta.feedDescription || '',
      channelLink: preserveMeta.channelLink || '',
      lastSyncedAt: preserveMeta.lastSyncedAt || '',
      clearedAt: new Date().toISOString(),
      totalJobs: 0,
    },
    jobs: [],
  };
}

export function channelFromFastXml(parsed) {
  return parsed?.rss?.channel ?? parsed?.channel ?? parsed;
}

export function channelFromDom(doc) {
  const channel = doc.querySelector('channel');
  if (!channel) return null;

  const getText = (el, tag) => {
    const node = el.querySelector(`:scope > ${tag}`);
    return node ? node.textContent.trim() : '';
  };

  const items = Array.from(channel.querySelectorAll(':scope > item')).map((itemEl) => {
    const sourceEl = itemEl.querySelector('source');
    return {
      guid: getText(itemEl, 'guid'),
      title: getText(itemEl, 'title'),
      description: getText(itemEl, 'description'),
      pubDate: getText(itemEl, 'pubDate'),
      link: getText(itemEl, 'link'),
      source: sourceEl ? { url: sourceEl.getAttribute('url') || '' } : '',
    };
  });

  return {
    title: getText(channel, 'title'),
    description: getText(channel, 'description'),
    link: getText(channel, 'link'),
    item: items,
  };
}

export function formatJobDate(isoOrDate) {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const INITIAL_SKIP_WORDS = new Set(['of', 'for', 'and', 'the', 'at', 'a', 'an', 'in', 'on']);

export function getEmployerInitials(employerName) {
  const raw = String(employerName || '').trim();
  if (!raw) return '??';
  const words = raw.split(/\s+/).filter((w) => w && !INITIAL_SKIP_WORDS.has(w.toLowerCase()));
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1) {
    const w = words[0].replace(/[^a-zA-Z0-9]/g, '');
    return (w.slice(0, 2) || '??').toUpperCase();
  }
  return '??';
}

export function parseRssXmlInBrowser(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML parsing failed. The feed may be malformed.');
  }
  const channel = channelFromDom(doc);
  if (!channel) throw new Error('No RSS channel found in the feed.');
  return channel;
}
