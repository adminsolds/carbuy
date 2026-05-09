const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendPasswordResetEmail } = require('../services/emailService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isValidPassword = (password) => {
  if (!password || password.length < 6) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Fields that can be set during registration
const PROFILE_FIELDS = [
  'ic_passport', 'gender', 'company_name', 'company_phone', 'tin_number',
  'address_street', 'address_zip', 'address_city', 'address_state', 'address_country'
];

// Serialize user for API response (exclude password)
const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  role: user.role,
  avatar_url: user.avatar_url,
  email_verified: user.email_verified,
  is_active: user.is_active,
  ic_passport: user.ic_passport,
  gender: user.gender,
  company_name: user.company_name,
  company_phone: user.company_phone,
  tin_number: user.tin_number,
  address_street: user.address_street,
  address_zip: user.address_zip,
  address_city: user.address_city,
  address_state: user.address_state,
  address_country: user.address_country,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const allowPublicRegister = String(process.env.ALLOW_PUBLIC_REGISTER || 'true').toLowerCase() === 'true';
    if (!allowPublicRegister) {
      return res.status(403).json({ error: 'Public registration is disabled. Contact administrator.' });
    }

    const {
      email, password, name, phone,
      ic_passport, gender, company_name, company_phone, tin_number,
      address_street, address_zip, address_city, address_state, address_country
    } = req.body;

    // Core validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters and contain uppercase, lowercase, and numbers.'
      });
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      phone: phone?.trim() || null,
      role: 'buyer',
      ic_passport: ic_passport?.trim() || null,
      gender: gender || null,
      company_name: company_name?.trim() || null,
      company_phone: company_phone?.trim() || null,
      tin_number: tin_number?.trim() || null,
      address_street: address_street?.trim() || null,
      address_zip: address_zip?.trim() || null,
      address_city: address_city?.trim() || null,
      address_state: address_state?.trim() || null,
      address_country: address_country?.trim() || null,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact administrator.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// Step 1: Request password reset — generates token and sends email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Return success to prevent email enumeration
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Generate secure reset token (valid 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.update({
      reset_token: resetToken,
      reset_token_expires: resetTokenExpires
    });

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
// Step 2: Verify token and reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters and contain uppercase, lowercase, and numbers.'
      });
    }

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expires: { [require('sequelize').Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });

    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters and contain uppercase, lowercase, and numbers.'
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// ─── PUT /api/auth/account ─────────────────────────────────────────────────────
// Update account basics (name/email/phone) and issue refreshed JWT.
router.put('/account', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { name, email, phone } = req.body;
    const updateFields = {};

    if (name !== undefined) {
      const nextName = String(name || '').trim();
      if (!nextName) return res.status(400).json({ error: 'Name cannot be empty.' });
      updateFields.name = nextName;
    }

    if (email !== undefined) {
      const nextEmail = String(email || '').trim().toLowerCase();
      if (!nextEmail || !isValidEmail(nextEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      const existing = await User.findOne({ where: { email: nextEmail } });
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
      updateFields.email = nextEmail;
    }

    if (phone !== undefined) {
      updateFields.phone = phone?.trim() || null;
    }

    await user.update(updateFields);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Account updated successfully.',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account.' });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const {
      name, phone, avatar_url,
      ic_passport, gender, company_name, company_phone, tin_number,
      address_street, address_zip, address_city, address_state, address_country
    } = req.body;

    const updateFields = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone?.trim() || null;
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url?.trim() || null;
    if (ic_passport !== undefined) updateFields.ic_passport = ic_passport?.trim() || null;
    if (gender !== undefined) updateFields.gender = gender || null;
    if (company_name !== undefined) updateFields.company_name = company_name?.trim() || null;
    if (company_phone !== undefined) updateFields.company_phone = company_phone?.trim() || null;
    if (tin_number !== undefined) updateFields.tin_number = tin_number?.trim() || null;
    if (address_street !== undefined) updateFields.address_street = address_street?.trim() || null;
    if (address_zip !== undefined) updateFields.address_zip = address_zip?.trim() || null;
    if (address_city !== undefined) updateFields.address_city = address_city?.trim() || null;
    if (address_state !== undefined) updateFields.address_state = address_state?.trim() || null;
    if (address_country !== undefined) updateFields.address_country = address_country?.trim() || null;

    await user.update(updateFields);

    res.json({
      message: 'Profile updated successfully.',
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;
