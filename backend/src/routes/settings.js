const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { getAuctionEnabled, setAuctionEnabled, parseBoolean } = require('../services/settingsService');
const { AppSetting } = require('../models');
const { invalidateTransporter } = require('../services/emailService');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const auctionEnabled = await getAuctionEnabled();
    res.json({ auctionEnabled });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch public settings.' });
  }
});

router.get('/', auth, authorize('seller'), async (req, res) => {
  try {
    const auctionEnabled = await getAuctionEnabled();
    const settings = await AppSetting.findAll({ where: { key: { [require('sequelize').Op.like]: 'smtp_%' } } });
    const smtpSettings = {};
    settings.forEach(s => { smtpSettings[s.key] = s.value; });
    res.json({ auctionEnabled, smtp: smtpSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

router.put('/auction-enabled', auth, authorize('seller'), async (req, res) => {
  try {
    if (req.body?.enabled === undefined) {
      return res.status(400).json({ error: 'enabled is required.' });
    }
    const nextValue = parseBoolean(req.body.enabled, false);
    const auctionEnabled = await setAuctionEnabled(nextValue);
    res.json({ message: 'Auction setting updated.', auctionEnabled });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

const EMAIL_KEYS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from', 'app_url'];

router.put('/smtp', auth, authorize('seller'), async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, app_url } = req.body;

    const upsert = async (key, value) => {
      const existing = await AppSetting.findOne({ where: { key } });
      if (existing) {
        await existing.update({ value: value ?? '' });
      } else {
        await AppSetting.create({ key, value: value ?? '' });
      }
    };

    if (smtp_host !== undefined) await upsert('smtp_host', smtp_host);
    if (smtp_port !== undefined) await upsert('smtp_port', String(smtp_port));
    if (smtp_secure !== undefined) await upsert('smtp_secure', String(smtp_secure));
    if (smtp_user !== undefined) await upsert('smtp_user', smtp_user);
    if (smtp_pass !== undefined) await upsert('smtp_pass', smtp_pass);
    if (smtp_from !== undefined) await upsert('smtp_from', smtp_from);
    if (app_url !== undefined) await upsert('app_url', app_url);

    invalidateTransporter();

    res.json({ message: 'SMTP settings updated.' });
  } catch (error) {
    console.error('Update SMTP settings error:', error);
    res.status(500).json({ error: 'Failed to update SMTP settings.' });
  }
});

router.post('/smtp/test', auth, authorize('seller'), async (req, res) => {
  try {
    const { sendPasswordResetEmail } = require('../services/emailService');
    await sendPasswordResetEmail(req.user.email, 'test-token');
    res.json({ message: 'Test email sent successfully.' });
  } catch (error) {
    console.error('Test SMTP email error:', error);
    res.status(500).json({ error: 'Failed to send test email: ' + error.message });
  }
});

module.exports = router;
