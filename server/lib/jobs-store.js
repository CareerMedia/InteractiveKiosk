import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeRssChannel,
  emptyJobsData,
  channelFromFastXml,
} from '../../src/shared/jobs-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
export const JOBS_PATH = path.join(ROOT, 'data', 'jobs.json');
export const JOBS_CONFIG_PATH = path.join(ROOT, 'data', 'jobs-config.json');

/** Vercel/Lambda deploy bundles are read-only; job data is committed to GitHub by admin. */
export function isEphemeralRuntime() {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, data) {
  if (isEphemeralRuntime()) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readJobsConfig() {
  return readJson(JOBS_CONFIG_PATH, { feedUrl: '', updatedAt: null });
}

export async function writeJobsConfig(config) {
  await writeJson(JOBS_CONFIG_PATH, config);
}

export async function readJobs() {
  return readJson(JOBS_PATH, emptyJobsData());
}

export async function writeJobs(data) {
  await writeJson(JOBS_PATH, data);
}

export async function clearJobs() {
  const current = await readJobs();
  const config = await readJobsConfig();
  const cleared = emptyJobsData({
    feedUrl: current.meta?.feedUrl || config.feedUrl || '',
    feedTitle: current.meta?.feedTitle || '',
    feedDescription: current.meta?.feedDescription || '',
    channelLink: current.meta?.channelLink || '',
    lastSyncedAt: current.meta?.lastSyncedAt || '',
  });
  await writeJobs(cleared);
  return cleared;
}

export function validateFeedUrl(url) {
  if (!url || typeof url !== 'string') throw new Error('RSS feed URL is required.');
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('RSS feed URL is not valid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('RSS feed URL must use http or https.');
  }
  return parsed.toString();
}

export async function fetchRssFeed(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'CSUN-Career-Kiosk/1.0 (+https://www.csun.edu/career)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch RSS feed (${res.status} ${res.statusText}).`);
  }
  const text = await res.text();
  if (!text.trim()) throw new Error('RSS feed returned an empty response.');
  return text;
}

export async function syncJobsFromFeed(feedUrl, { XMLParser }) {
  const data = await parseJobsFromFeed(feedUrl, { XMLParser });
  const url = validateFeedUrl(feedUrl);

  if (!isEphemeralRuntime()) {
    await writeJobs(data);
    await writeJobsConfig({ feedUrl: url, updatedAt: new Date().toISOString() });
  }

  return data;
}

export async function parseJobsFromFeed(feedUrl, { XMLParser }) {
  const url = validateFeedUrl(feedUrl);
  const xmlText = await fetchRssFeed(url);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  let parsed;
  try {
    parsed = parser.parse(xmlText);
  } catch {
    throw new Error('XML parsing failed. The feed may be malformed.');
  }

  const channel = channelFromFastXml(parsed);
  if (!channel) throw new Error('No RSS channel found in the feed.');

  const data = normalizeRssChannel(channel, url);
  if (!data.jobs.length) {
    data.errors = ['No job items were found in the feed.'];
  }

  return data;
}
