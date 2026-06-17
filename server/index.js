import 'dotenv/config';
import express from 'express';
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
} from './lib/jobs-store.js';
import {
  buildJobListEmail,
  sendViaBrevo,
  sendTestEmail,
  isValidEmail,
  safeErrorMessage,
} from './lib/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'career1';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limit for email endpoint
const emailRateLimit = new Map();
const EMAIL_LIMIT_WINDOW_MS = 60_000;
const EMAIL_LIMIT_MAX = 5;

function checkAdminAuth(req) {
  const header = req.headers['x-admin-password'] || '';
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const password = header || bearer;
  return password === ADMIN_PASSWORD;
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

// ─── Public API ─────────────────────────────────────────────────────────────

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
  if (jobIds.length > 25) {
    return res.status(400).json({ success: false, error: 'You can email up to 25 jobs at a time.' });
  }

  try {
    const data = await readJobs();
    const idSet = new Set(jobIds.map(String));
    const selected = (data.jobs || []).filter((j) => idSet.has(String(j.id)));

    if (!selected.length) {
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
    console.error('Email send error:', err);
    res.status(500).json({ success: false, error: safeErrorMessage(err) });
  }
});

app.post('/api/admin/jobs/test-email', adminOnly, async (req, res) => {
  const { testEmail, testName } = req.body || {};

  if (!isValidEmail(testEmail)) {
    return res.status(400).json({ success: false, error: 'A valid test email address is required.' });
  }

  try {
    await sendTestEmail({
      testEmail: testEmail.trim(),
      testName: testName?.trim() || '',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ success: false, error: safeErrorMessage(err) });
  }
});

// ─── Admin API ───────────────────────────────────────────────────────────────

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
    const feedUrl = req.body?.feedUrl != null ? validateFeedUrl(req.body.feedUrl) : '';
    const config = { feedUrl, updatedAt: new Date().toISOString() };
    await writeJobsConfig(config);

    const jobs = await readJobs();
    if (jobs.meta) jobs.meta.feedUrl = feedUrl;
    await writeJobs(jobs);

    res.json({ success: true, feedUrl });
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
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Static files ───────────────────────────────────────────────────────────

app.use(express.static(ROOT));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CSUN Career Kiosk server running at http://localhost:${PORT}`);
  console.log(`  Kiosk:  http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin/`);
});
