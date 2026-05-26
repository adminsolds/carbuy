const nodemailer = require('nodemailer');
const { AppSetting } = require('../models');

let _transporter = null;

const getSetting = async (key, fallback) => {
  const row = await AppSetting.findOne({ where: { key } });
  return row ? row.value : fallback;
};

// Build transporter from DB settings (cached)
const getTransporter = async () => {
  if (_transporter) return _transporter;

  const host = await getSetting('smtp_host', 'smtp.example.com');
  const port = parseInt(await getSetting('smtp_port', '587'), 10);
  const secure = (await getSetting('smtp_secure', 'false')) === 'true';
  const user = await getSetting('smtp_user', '');
  const pass = await getSetting('smtp_pass', '');

  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return _transporter;
};

// Invalidate cached transporter when settings change
const invalidateTransporter = () => { _transporter = null; };

const APP_NAME = 'SG Auto Trading';

const buildVerificationEmailContent = async (code) => {
  const normalizedCode = String(code || '').trim();
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1E3A5F; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">${APP_NAME}</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">Email Verification Code</h2>
        <p style="color: #555; line-height: 1.6;">
          Use the following verification code to activate your account:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; letter-spacing: 8px; font-size: 28px; font-weight: 700; color: #1E3A5F; background: #fff; border: 1px dashed #D4A84B; border-radius: 8px; padding: 12px 20px;">
            ${normalizedCode}
          </span>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.6;">
          This code is valid for 10 minutes. If you did not create an account, you can ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;"/>
        <p style="color: #aaa; font-size: 12px; margin: 0;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return {
    subject: '[SG Auto Trading] Email Verification Code',
    html: htmlContent
  };
};

const buildResetEmailContent = async (resetToken) => {
  const row = await AppSetting.findOne({ where: { key: 'app_url' } });
  const appUrl = row ? row.value : 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1E3A5F; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">SG Auto Trading</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #555; line-height: 1.6;">
          We received a request to reset your password for your SG Auto Trading account associated with this email address.
        </p>
        <p style="color: #555; line-height: 1.6;">
          Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #D4A84B; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.6;">
          If you did not request a password reset, please ignore this email. Your password will remain unchanged.<br/>
          This link can only be used once. If you request another reset, a new link will be sent.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;"/>
        <p style="color: #aaa; font-size: 12px; margin: 0;">
          &copy; ${new Date().getFullYear()} SG Auto Trading. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return {
    subject: '[SG Auto Trading] Password Reset Request',
    html: htmlContent
  };
};

const sendEmailViaSmtp = async ({ toEmail, subject, html }) => {
  const transporter = await getTransporter();
  const fromAddress = (await AppSetting.findOne({ where: { key: 'smtp_from' } }))?.value || 'noreply@sgautotrading.local';
  await transporter.sendMail({
    from: `"SG Auto Trading" <${fromAddress}>`,
    to: toEmail,
    subject,
    html
  });
};

const sendEmailViaResend = async ({ toEmail, subject, html }) => {
  const apiKey = await getSetting('resend_api_key', '');
  if (!apiKey) {
    throw new Error('Resend API key is not configured.');
  }

  const fromAddress = await getSetting('resend_from', '') || await getSetting('smtp_from', '') || 'noreply@sgautotrading.local';
  if (!fromAddress) {
    throw new Error('Resend sender email is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `"${APP_NAME}" <${fromAddress}>`,
      to: [toEmail],
      subject,
      html
    })
  });

  if (!response.ok) {
    let details = '';
    try {
      const payload = await response.json();
      details = payload?.message || payload?.error || JSON.stringify(payload);
    } catch {
      details = await response.text();
    }
    throw new Error(`Resend send failed (${response.status}): ${details || 'unknown error'}`);
  }
};

const sendPasswordResetEmail = async (toEmail, resetToken) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const provider = String(await getSetting('email_provider', 'smtp')).trim().toLowerCase() || 'smtp';
  const { subject, html } = await buildResetEmailContent(resetToken);

  try {
    if (provider === 'resend') {
      await sendEmailViaResend({ toEmail, subject, html });
    } else {
      await sendEmailViaSmtp({ toEmail, subject, html });
    }
    console.log(`Password reset email sent to ${toEmail} via ${provider}`);
  } catch (error) {
    console.error(`Failed to send password reset email via ${provider}:`, error.message);
    throw error;
  }
};

const sendVerificationCodeEmail = async (toEmail, code) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const provider = String(await getSetting('email_provider', 'smtp')).trim().toLowerCase() || 'smtp';
  const { subject, html } = await buildVerificationEmailContent(code);

  try {
    if (provider === 'resend') {
      await sendEmailViaResend({ toEmail, subject, html });
    } else {
      await sendEmailViaSmtp({ toEmail, subject, html });
    }
    console.log(`Verification code email sent to ${toEmail} via ${provider}`);
  } catch (error) {
    console.error(`Failed to send verification code email via ${provider}:`, error.message);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail, sendVerificationCodeEmail, invalidateTransporter };
