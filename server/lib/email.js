import { formatJobDate } from '../../src/shared/jobs-parser.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jobBlock(job) {
  const title = escapeHtml(job.displayTitle || job.title);
  const employer = escapeHtml(job.employer);
  const posted = formatJobDate(job.pubDate);
  const expires = formatJobDate(job.expiresAt);
  const summary = escapeHtml(job.summary || job.descriptionText?.slice(0, 300) || '');
  const url = job.applicationUrl ? escapeHtml(job.applicationUrl) : '';

  const linkHtml = url
    ? `<a href="${url}" style="display:inline-block;padding:10px 18px;background:#d22030;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Job on Handshake</a>`
    : '';

  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e8e8e8;">
        <h2 style="margin:0 0 6px;font-size:18px;color:#1a1a1a;">${title}</h2>
        ${employer ? `<p style="margin:0 0 8px;font-size:14px;color:#555;">${employer}</p>` : ''}
        <p style="margin:0 0 4px;font-size:13px;color:#777;">Posted ${posted || '—'}</p>
        <p style="margin:0 0 10px;font-size:13px;color:#d22030;">Expires ${expires || '—'}</p>
        ${summary ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#333;">${summary}</p>` : ''}
        ${linkHtml}
      </td>
    </tr>`;
}

function jobBlockText(job) {
  const lines = [
    job.displayTitle || job.title,
    job.employer ? `Employer: ${job.employer}` : '',
    `Posted: ${formatJobDate(job.pubDate) || '—'}`,
    `Expires: ${formatJobDate(job.expiresAt) || '—'}`,
    job.summary ? job.summary : '',
    job.applicationUrl ? `View on Handshake: ${job.applicationUrl}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

export function buildJobListEmail({ studentName, jobs }) {
  const senderName = process.env.BREVO_SENDER_NAME || 'CSUN Career Center';
  const greeting = studentName
    ? `<p style="margin:0 0 16px;font-size:16px;color:#333;">Hi ${escapeHtml(studentName)},</p>`
    : '';

  const htmlJobs = jobs.map(jobBlock).join('');
  const textJobs = jobs.map((j, i) => `${i + 1}. ${jobBlockText(j)}`).join('\n\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Barlow,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
        <tr><td style="background:#d22030;padding:24px 28px;">
          <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">Your Career Fair Job List</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          ${greeting}
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#333;">
            Here are the job opportunities you selected at the CSUN Career Center career fair kiosk.
            Click any link below to view the full posting and apply on Handshake.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${htmlJobs}</table>
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f9f9f9;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">
            ${escapeHtml(senderName)}<br>
            California State University, Northridge<br>
            <a href="https://www.csun.edu/career" style="color:#d22030;">csun.edu/career</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent = [
    'Your Career Fair Job List',
    studentName ? `Hi ${studentName},` : '',
    '',
    'Here are the job opportunities you selected at the CSUN Career Center career fair kiosk:',
    '',
    textJobs,
    '',
    '—',
    senderName,
    'California State University, Northridge',
    'https://www.csun.edu/career',
  ].filter((l) => l !== undefined).join('\n');

  return { htmlContent, textContent };
}

export async function sendViaBrevo({ toEmail, toName, subject, htmlContent, textContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'CSUN Career Center';

  if (!apiKey) {
    const err = new Error('BREVO_API_KEY is not configured on the server.');
    err.code = 'BREVO_NOT_CONFIGURED';
    throw err;
  }
  if (!senderEmail) {
    const err = new Error('BREVO_SENDER_EMAIL is not configured on the server.');
    err.code = 'BREVO_NOT_CONFIGURED';
    throw err;
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent: htmlContent || '<p></p>',
    textContent: textContent || subject,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let bodyMsg = '';
    let bodyText = '';
    try {
      const body = await res.json();
      bodyText = JSON.stringify(body);
      bodyMsg = body.message || body.code || '';
    } catch {
      try {
        bodyText = (await res.text()).slice(0, 500);
      } catch { /* ignore */ }
    }
    const err = new Error(bodyMsg || `Brevo API error (${res.status})`);
    err.brevoStatus = res.status;
    err.brevoBody = bodyText;
    throw err;
  }

  return res.json();
}

export function getBrevoEnvStatus() {
  return {
    hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
    hasSenderEmail: Boolean(process.env.BREVO_SENDER_EMAIL),
    hasSenderName: Boolean(process.env.BREVO_SENDER_NAME),
  };
}

export function logEmailDiagnostics(route, details) {
  const safe = {
    route,
    ...getBrevoEnvStatus(),
    ...details,
  };
  if (safe.brevoBody && typeof safe.brevoBody === 'string') {
    safe.brevoBody = safe.brevoBody.slice(0, 500);
  }
  console.error('[email]', JSON.stringify(safe));
}

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function buildTestEmail({ testName }) {
  const senderName = process.env.BREVO_SENDER_NAME || 'CSUN Career Center';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || '';
  const envName = process.env.NODE_ENV || 'production';
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const greeting = testName ? `Hi ${escapeHtml(testName)},` : 'Hello,';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;font-family:Barlow,'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 16px;font-size:22px;color:#d22030;">CSUN Career Center Kiosk Email Test</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333;">${greeting}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333;">
      This is a test email from the CSUN Career Center Job Opportunities kiosk.
      If you received this, Brevo is connected correctly.
    </p>
    <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">
      Sent: ${escapeHtml(timestamp)} (Pacific)<br>
      Environment: ${escapeHtml(envName)}<br>
      From: ${escapeHtml(senderName)} &lt;${escapeHtml(senderEmail)}&gt;
    </p>
  </div>
</body>
</html>`;

  const textContent = [
    'CSUN Career Center Kiosk Email Test',
    '',
    greeting,
    '',
    'This is a test email from the CSUN Career Center Job Opportunities kiosk.',
    'If you received this, Brevo is connected correctly.',
    '',
    `Sent: ${timestamp} (Pacific)`,
    `Environment: ${envName}`,
    `From: ${senderName} <${senderEmail}>`,
  ].join('\n');

  return { htmlContent, textContent };
}

export async function sendTestEmail({ testEmail, testName }) {
  const { htmlContent, textContent } = buildTestEmail({ testName });
  return sendViaBrevo({
    toEmail: testEmail,
    toName: testName || testEmail,
    subject: 'CSUN Career Center Kiosk Email Test',
    htmlContent,
    textContent,
  });
}

function safeErrorMessage(err) {
  const msg = String(err?.message || 'Email could not be sent.');
  if (msg.includes('BREVO_API_KEY') || msg.includes('BREVO_SENDER') || err?.code === 'BREVO_NOT_CONFIGURED') {
    return 'Brevo is not configured on the server. Check environment variables.';
  }
  if (msg.toLowerCase().includes('api-key') || msg.toLowerCase().includes('unauthorized')) {
    return 'Brevo rejected the request. Verify your API key and sender email.';
  }
  return msg.length > 200 ? 'Email could not be sent. Check server logs for details.' : msg;
}

export function publicEmailError() {
  return 'EMAIL_SEND_FAILED';
}

export { safeErrorMessage };
