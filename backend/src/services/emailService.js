const nodemailer = require('nodemailer');
const { AppSetting } = require('../models');

let _transporter = null;

// Build transporter from DB settings (cached)
const getTransporter = async () => {
  if (_transporter) return _transporter;

  const getSetting = async (key, fallback) => {
    const row = await AppSetting.findOne({ where: { key } });
    return row ? row.value : fallback;
  };

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

const sendPasswordResetEmail = async (toEmail, resetToken) => {
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

  const transporter = await getTransporter();
  const fromAddress = (await AppSetting.findOne({ where: { key: 'smtp_from' } }))?.value || 'noreply@sgautotrading.local';

  try {
    await transporter.sendMail({
      from: `"SG Auto Trading" <${fromAddress}>`,
      to: toEmail,
      subject: '[SG Auto Trading] Password Reset Request',
      html: htmlContent
    });
    console.log(`Password reset email sent to ${toEmail}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail, invalidateTransporter };
