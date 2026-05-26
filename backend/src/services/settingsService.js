const { AppSetting } = require('../models');

const AUCTION_KEY = 'auction_enabled';
const EMAIL_PROVIDER_KEY = 'email_provider';

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const getDefaultAuctionEnabled = () =>
  parseBoolean(process.env.AUCTION_ENABLED, false);

const getAuctionEnabled = async () => {
  const setting = await AppSetting.findOne({ where: { key: AUCTION_KEY } });
  if (!setting) return getDefaultAuctionEnabled();
  return parseBoolean(setting.value, getDefaultAuctionEnabled());
};

const setAuctionEnabled = async (enabled) => {
  const normalized = parseBoolean(enabled, false);
  const value = normalized ? 'true' : 'false';
  await AppSetting.upsert({
    key: AUCTION_KEY,
    value,
    description: 'Global auction feature switch',
  });
  return normalized;
};

const ensureSettingsSeeded = async () => {
  const existing = await AppSetting.findOne({ where: { key: AUCTION_KEY } });
  if (!existing) {
    await AppSetting.create({
      key: AUCTION_KEY,
      value: getDefaultAuctionEnabled() ? 'true' : 'false',
      description: 'Global auction feature switch',
    });
  }

  const emailProvider = await AppSetting.findOne({ where: { key: EMAIL_PROVIDER_KEY } });
  if (!emailProvider) {
    await AppSetting.create({
      key: EMAIL_PROVIDER_KEY,
      value: 'smtp',
      description: 'Email provider: smtp | resend'
    });
  }
};

module.exports = {
  parseBoolean,
  getAuctionEnabled,
  setAuctionEnabled,
  ensureSettingsSeeded,
};
