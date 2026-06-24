import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import {
  readJobs,
  readJobsConfig,
  writeJobs,
  writeJobsConfig,
  clearJobs,
  syncJobsFromFeed,
  validateFeedUrl,
  isEphemeralRuntime,
} from './lib/jobs-store.js';
import {
  buildJobListEmail,
  sendViaBrevo,
  sendTestEmail,
  isValidEmail,
  safeErrorMessage,
  publicEmailError,
  logEmailDiagnostics,
  getBrevoEnvStatus,
} from './lib/email.js';
import { MAX_EMAIL_JOBS } from '../src/shared/jobs-constants.js';
import {
  readAds,
  writeAds,
  publicAdsPayload,
  findAdById,
  createAdRecord,
  saveAdMedia,
  deleteAdMedia,
  validateAdFile,
  ADS_JSON_PATH,
  ADS_DIR,
} from './lib/ads-store.js';
import {
  hasGithubCommitSupport,
  getGithubJsonFile,
  commitGithubFiles,
  deleteGithubFile,
} from './lib/github-commit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'career1';

const LOGO_DIRS = new Set(['assets/employers/attendees', 'assets/employers/partners']);
const LOGO_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'svg', 'webp', 'avif', 'gif']);

function formatLogoName(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const emailRateLimit = new Map();
const EMAIL_LIMIT_WINDOW_MS = 60_000;
const EMAIL_LIMIT_MAX = 5;

function checkAdminAuth(req) {
  const header = req.headers['x-admin-password'] || '';
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return (header || bearer) === ADMIN_PASSWORD;
}

function adminOnly(req, res, next) {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

function checkEmailRateLimit(ip) {
  const now = Date.now();
  const entry = emailRateLimit.get(ip) || { count: 0, resetAt: now + EMAIL_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + EMAIL_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  emailRateLimit.set(ip, entry);
  return entry.count <= EMAIL_LIMIT_MAX;
}

export function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.set('trust proxy', 1);

  // Allow GitHub Pages kiosk/admin to call this API on Vercel or another host.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password, Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
      hasSenderEmail: Boolean(process.env.BREVO_SENDER_EMAIL),
    });
  });

  app.get('/api/logos', async (req, res) => {
    const dir = String(req.query.dir || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!LOGO_DIRS.has(dir)) {
      return res.status(400).json({ error: 'Invalid logo directory' });
    }
    try {
      const names = await fs.readdir(path.join(ROOT, dir));
      const items = names
        .filter((name) => LOGO_EXTENSIONS.has((name.split('.').pop() || '').toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: formatLogoName(name),
          src: `/${dir}/${name}`,
        }));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/jobs', async (_req, res) => {
    try {
      const data = await readJobs();
      res.json({
        meta: {
          sourceType: data.meta?.sourceType,
          feedTitle: data.meta?.feedTitle,
          feedDescription: data.meta?.feedDescription,
          channelLink: data.meta?.channelLink,
          lastSyncedAt: data.meta?.lastSyncedAt,
          clearedAt: data.meta?.clearedAt,
          totalJobs: data.meta?.totalJobs ?? (data.jobs?.length || 0),
        },
        jobs: data.jobs || [],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/jobs/send-list', async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!checkEmailRateLimit(ip)) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment and try again.' });
    }

    const { studentName, studentEmail, jobs: jobIds } = req.body || {};

    if (!isValidEmail(studentEmail)) {
      return res.status(400).json({ success: false, error: 'A valid student email address is required.' });
    }
    if (!Array.isArray(jobIds) || !jobIds.length) {
      return res.status(400).json({ success: false, error: 'Select at least one job to email.' });
    }
    if (jobIds.length > MAX_EMAIL_JOBS) {
      return res.status(400).json({
        success: false,
        error: `You can email up to ${MAX_EMAIL_JOBS} jobs at a time.`,
      });
    }

    try {
      const data = await readJobs();
      const idSet = new Set(jobIds.map(String));
      const selected = (data.jobs || []).filter((j) => idSet.has(String(j.id)));

      if (!selected.length) {
        logEmailDiagnostics('/api/jobs/send-list', {
          selectedJobCount: jobIds.length,
          matchedJobCount: 0,
          message: 'No matching jobs found',
        });
        return res.status(400).json({ success: false, error: 'None of the selected jobs were found.' });
      }

      const subject = 'Your Career Fair Job List from the CSUN Career Center';
      const { htmlContent, textContent } = buildJobListEmail({
        studentName: studentName?.trim() || '',
        jobs: selected,
      });

      await sendViaBrevo({
        toEmail: studentEmail.trim(),
        toName: studentName?.trim() || studentEmail.trim(),
        subject,
        htmlContent,
        textContent,
      });

      res.json({ success: true, sent: selected.length });
    } catch (err) {
      const data = await readJobs().catch(() => ({ jobs: [] }));
      const idSet = new Set(jobIds.map(String));
      const matched = (data.jobs || []).filter((j) => idSet.has(String(j.id)));
      logEmailDiagnostics('/api/jobs/send-list', {
        selectedJobCount: jobIds.length,
        matchedJobCount: matched.length,
        brevoStatus: err.brevoStatus ?? null,
        brevoBody: err.brevoBody ?? null,
        message: err.message,
      });
      res.status(500).json({ success: false, error: publicEmailError() });
    }
  });

  app.post('/api/admin/jobs/test-email', adminOnly, async (req, res) => {
    const { testEmail, testName } = req.body || {};

    if (!isValidEmail(testEmail)) {
      return res.status(400).json({ success: false, error: 'A valid test email address is required.' });
    }

    const envStatus = getBrevoEnvStatus();
    if (!envStatus.hasBrevoApiKey || !envStatus.hasSenderEmail) {
      logEmailDiagnostics('/api/admin/jobs/test-email', {
        ...envStatus,
        message: 'Missing Brevo configuration',
      });
      return res.status(500).json({
        success: false,
        error: 'Brevo is not configured on the server. Check BREVO_API_KEY and BREVO_SENDER_EMAIL.',
      });
    }

    try {
      await sendTestEmail({
        testEmail: testEmail.trim(),
        testName: testName?.trim() || '',
      });
      res.json({ success: true });
    } catch (err) {
      logEmailDiagnostics('/api/admin/jobs/test-email', {
        brevoStatus: err.brevoStatus ?? null,
        brevoBody: err.brevoBody ?? null,
        message: err.message,
      });
      res.status(500).json({ success: false, error: safeErrorMessage(err) });
    }
  });

  app.get('/api/admin/jobs/config', adminOnly, async (_req, res) => {
    try {
      const config = await readJobsConfig();
      const jobs = await readJobs();
      res.json({
        feedUrl: config.feedUrl || jobs.meta?.feedUrl || '',
        updatedAt: config.updatedAt,
        meta: jobs.meta,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/jobs/config', adminOnly, async (req, res) => {
    try {
      const raw = req.body?.feedUrl;
      const feedUrl = raw != null && String(raw).trim()
        ? validateFeedUrl(raw)
        : '';

      const config = { feedUrl, updatedAt: new Date().toISOString() };
      await writeJobsConfig(config);

      const jobs = await readJobs();
      if (jobs.meta) jobs.meta.feedUrl = feedUrl;

      if (!isEphemeralRuntime()) {
        await writeJobs(jobs);
      }

      res.json({ success: true, feedUrl, config, meta: jobs.meta });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/jobs/sync', adminOnly, async (req, res) => {
    try {
      const config = await readJobsConfig();
      const feedUrl = req.body?.feedUrl || config.feedUrl;
      if (!feedUrl) {
        return res.status(400).json({ success: false, error: 'Save an RSS feed URL before syncing.' });
      }

      const data = await syncJobsFromFeed(feedUrl, { XMLParser });
      res.json({
        success: true,
        totalJobs: data.meta.totalJobs,
        lastSyncedAt: data.meta.lastSyncedAt,
        feedTitle: data.meta.feedTitle,
        meta: data.meta,
        jobs: data.jobs,
        errors: data.errors || [],
      });
    } catch (err) {
      console.error('Sync error:', err);
      res.status(500).json({ success: false, error: err.message, errors: [err.message] });
    }
  });

  app.post('/api/admin/jobs/clear', adminOnly, async (_req, res) => {
    try {
      const data = await clearJobs();
      res.json({
        success: true,
        clearedAt: data.meta.clearedAt,
        totalJobs: 0,
        meta: data.meta,
        jobs: data.jobs,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/ads', async (_req, res) => {
    try {
      const data = await readAds();
      res.json(publicAdsPayload(data));
    } catch (err) {
      res.status(500).json({ success: false, error: 'Could not load ads.' });
    }
  });

  app.get('/api/admin/ads', adminOnly, async (_req, res) => {
    try {
      const data = await readAds();
      res.json({ success: true, ...data, githubCommit: hasGithubCommitSupport() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/ads/upload', adminOnly, async (req, res) => {
    try {
      const {
        title,
        active = true,
        startDate = '',
        endDate = '',
        fileName,
        mimeType = '',
        base64,
      } = req.body || {};

      if (!base64 || !fileName) {
        return res.status(400).json({ success: false, error: 'A valid file is required.' });
      }

      const buffer = Buffer.from(String(base64), 'base64');
      const validation = validateAdFile({ name: fileName, size: buffer.length, type: mimeType });
      if (!validation.ok) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const saved = await saveAdMedia(buffer, fileName, title, mimeType);
      const data = await readAds();
      const maxOrder = (data.ads || []).reduce((m, ad) => Math.max(m, ad.order ?? 0), -1);
      const record = createAdRecord({
        title,
        fileName: saved.fileName,
        fileSize: buffer.length,
        mimeType,
        type: saved.type,
        src: saved.src,
      });
      record.active = Boolean(active);
      record.startDate = startDate || '';
      record.endDate = endDate || '';
      record.order = maxOrder + 1;

      const next = {
        ...data,
        ads: [...(data.ads || []), record],
      };
      next.meta = {
        ...next.meta,
        lastUpdatedAt: new Date().toISOString(),
        totalAds: next.ads.length,
      };

      if (hasGithubCommitSupport()) {
        await commitGithubFiles({
          message: `admin: upload kiosk ad ${saved.fileName}`,
          files: [
            { path: `${ADS_DIR}/${saved.fileName}`, content: buffer.toString('base64'), encoding: 'base64' },
            { path: ADS_JSON_PATH, content: next },
          ],
        });
      } else {
        await writeAds(next);
      }

      res.json({ success: true, ad: record, ads: next.ads });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'Ad upload failed. Please check the file type, file size, and try again.',
        detail: err.message,
      });
    }
  });

  app.patch('/api/admin/ads/:id', adminOnly, async (req, res) => {
    try {
      const data = await readAds();
      const ad = findAdById(data, req.params.id);
      if (!ad) return res.status(404).json({ success: false, error: 'Ad not found.' });

      const body = req.body || {};
      if (body.title != null) ad.title = String(body.title).trim() || ad.title;
      if (body.active != null) ad.active = Boolean(body.active);
      if (body.startDate != null) ad.startDate = body.startDate || '';
      if (body.endDate != null) ad.endDate = body.endDate || '';
      if (body.order != null) ad.order = Number(body.order) || 0;
      ad.updatedAt = new Date().toISOString();

      const next = { ...data, ads: (data.ads || []).map((a) => (a.id === ad.id ? ad : a)) };
      next.meta = { ...next.meta, lastUpdatedAt: ad.updatedAt, totalAds: next.ads.length };

      if (hasGithubCommitSupport()) {
        await commitGithubFiles({
          message: `admin: update kiosk ad ${ad.id}`,
          files: [{ path: ADS_JSON_PATH, content: next }],
        });
      } else {
        await writeAds(next);
      }

      res.json({ success: true, ad, ads: next.ads });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/ads/:id', adminOnly, async (req, res) => {
    try {
      const data = await readAds();
      const ad = findAdById(data, req.params.id);
      if (!ad) return res.status(404).json({ success: false, error: 'Ad not found.' });

      const next = {
        ...data,
        ads: (data.ads || []).filter((a) => a.id !== ad.id),
      };
      next.meta = {
        ...next.meta,
        lastUpdatedAt: new Date().toISOString(),
        totalAds: next.ads.length,
      };

      if (hasGithubCommitSupport() && ad.fileName) {
        try {
          await deleteGithubFile(`${ADS_DIR}/${ad.fileName}`, `admin: delete kiosk ad ${ad.fileName}`);
        } catch {
          /* metadata removal still proceeds */
        }
        await commitGithubFiles({
          message: `admin: remove kiosk ad ${ad.id}`,
          files: [{ path: ADS_JSON_PATH, content: next }],
        });
      } else {
        await deleteAdMedia(ad.fileName);
        await writeAds(next);
      }

      res.json({ success: true, ads: next.ads });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  if (serveStatic) {
    app.use(express.static(ROOT));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      if (req.path.includes('.')) return next();
      res.sendFile(path.join(ROOT, 'index.html'));
    });
  }

  return app;
}
