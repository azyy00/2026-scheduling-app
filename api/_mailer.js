const hasEmailProvider = () => Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

const fromAddress = () => (
  process.env.MAIL_FROM ||
  process.env.SMTP_FROM ||
  process.env.SMTP_USER ||
  process.env.ADMIN_EMAIL ||
  ''
).trim();

const sendWithResend = async ({ to, subject, text, html }) => {
  const from = fromAddress();
  if (!from) throw new Error('MAIL_FROM is required for Resend email delivery.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend email failed: ${response.status} ${detail}`.trim());
  }
};

const sendWithSmtp = async ({ to, subject, text, html }) => {
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
    : undefined;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth,
  });

  await transporter.sendMail({
    from: fromAddress() || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

const sendMail = async (message) => {
  if (process.env.RESEND_API_KEY) return sendWithResend(message);
  if (process.env.SMTP_HOST) return sendWithSmtp(message);
  throw new Error('Email provider is not configured.');
};

module.exports = { hasEmailProvider, sendMail };
