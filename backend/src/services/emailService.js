const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
};

const transporter = createTransporter();

const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  const from = process.env.EMAIL_FROM || 'no-reply@homestay.local';
  await transporter.sendMail({ from, to, subject, html });
};

module.exports = { sendEmail };
