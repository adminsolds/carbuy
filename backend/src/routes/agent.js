const express = require('express');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Agent, User } = require('../models');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();
const DEFAULT_AGENT_AVATAR = '/uploads/default-agent-avatar.svg';

function normalizeAvatarUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  return url || DEFAULT_AGENT_AVATAR;
}

function serializeAgent(agent) {
  const plain = agent?.toJSON ? agent.toJSON() : agent;
  return {
    ...plain,
    avatar_url: normalizeAvatarUrl(plain?.avatar_url),
    access_enabled: Boolean(plain?.access_enabled),
    access_user_id: plain?.access_user_id || null,
    can_add_car: plain?.can_add_car !== false,
    can_edit_car: plain?.can_edit_car !== false,
    can_update_order_status: plain?.can_update_order_status !== false
  };
}

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const isStrongPassword = (password) => {
  if (!password || password.length < 6) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
};

const generateTempPassword = () => `Agent@${Math.random().toString(36).slice(2, 8)}A1`;

// ─── Public: List / Search agents (for frontend) ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, is_active } = req.query;
    const where = {};

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }

    const agents = await Agent.findAll({
      where,
      attributes: ['id', 'code', 'name', 'email', 'phone', 'company', 'address', 'is_active', 'avatar_url', 'notes'],
      order: [['name', 'ASC']]
    });

    res.json({ agents: agents.map(serializeAgent) });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents.' });
  }
});

// ─── Admin: List agents (paginated) ───────────────────────────────────────────
router.get('/admin/list', auth, authorize('seller'), async (req, res) => {
  try {
    const {
      search, is_active,
      limit = 20, offset = 0,
      sortBy = 'createdAt', sortOrder = 'DESC'
    } = req.query;

    const where = {};
    if (is_active !== undefined && is_active !== 'all') {
      where.is_active = is_active === 'true';
    }
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }

    const allowedSort = ['createdAt', 'name', 'code', 'company'];
    const resolvedSort = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: agents } = await Agent.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[resolvedSort, resolvedOrder]]
    });

    res.json({ agents: agents.map(serializeAgent), total: count });
  } catch (error) {
    console.error('Admin list agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents.' });
  }
});

// ─── Admin: Get single agent ──────────────────────────────────────────────────
router.get('/:id', auth, authorize('seller'), async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    res.json({ agent: serializeAgent(agent) });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent.' });
  }
});

// ─── Admin: Create agent ───────────────────────────────────────────────────────
router.post('/', auth, authorize('seller'), async (req, res) => {
  try {
    const {
      code, name, email, phone, company, address, is_active, notes, avatar_url,
      can_add_car, can_edit_car, can_update_order_status
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Agent code and name are required.' });
    }

    const existing = await Agent.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: 'Agent code already exists.' });
    }

    const agent = await Agent.create({
      code: code.trim(),
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      avatar_url: normalizeAvatarUrl(avatar_url),
      access_enabled: false,
      access_user_id: null,
      can_add_car: can_add_car !== false,
      can_edit_car: can_edit_car !== false,
      can_update_order_status: can_update_order_status !== false,
      address: address?.trim() || null,
      is_active: is_active !== false,
      notes: notes?.trim() || null
    });

    res.status(201).json({ message: 'Agent created successfully.', agent: serializeAgent(agent) });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent.' });
  }
});

// ─── Admin: Update agent ───────────────────────────────────────────────────────
router.put('/:id', auth, authorize('seller'), async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });

    const {
      code, name, email, phone, company, address, is_active, notes, avatar_url,
      can_add_car, can_edit_car, can_update_order_status
    } = req.body;

    if (code && code !== agent.code) {
      const existing = await Agent.findOne({ where: { code } });
      if (existing) return res.status(400).json({ error: 'Agent code already exists.' });
    }

    await agent.update({
      code: code !== undefined ? code.trim() : agent.code,
      name: name !== undefined ? name.trim() : agent.name,
      email: email !== undefined ? (email?.trim() || null) : agent.email,
      phone: phone !== undefined ? (phone?.trim() || null) : agent.phone,
      company: company !== undefined ? (company?.trim() || null) : agent.company,
      avatar_url: avatar_url !== undefined ? normalizeAvatarUrl(avatar_url) : agent.avatar_url,
      address: address !== undefined ? (address?.trim() || null) : agent.address,
      is_active: is_active !== undefined ? Boolean(is_active) : agent.is_active,
      notes: notes !== undefined ? (notes?.trim() || null) : agent.notes,
      can_add_car: can_add_car !== undefined ? Boolean(can_add_car) : agent.can_add_car,
      can_edit_car: can_edit_car !== undefined ? Boolean(can_edit_car) : agent.can_edit_car,
      can_update_order_status: can_update_order_status !== undefined ? Boolean(can_update_order_status) : agent.can_update_order_status
    });

    res.json({ message: 'Agent updated successfully.', agent: serializeAgent(agent) });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent.' });
  }
});

// ─── Admin: Grant/Revoke backend access for an agent ───────────────────────────
router.put('/:id/access', auth, authorize('seller'), async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });

    const enabled = Boolean(req.body.enabled);
    const canAddCar = req.body.can_add_car !== undefined ? Boolean(req.body.can_add_car) : agent.can_add_car;
    const canEditCar = req.body.can_edit_car !== undefined ? Boolean(req.body.can_edit_car) : agent.can_edit_car;
    const canUpdateOrderStatus = req.body.can_update_order_status !== undefined
      ? Boolean(req.body.can_update_order_status)
      : agent.can_update_order_status;
    const email = normalizeEmail(agent.email);
    const providedPassword = req.body.password ? String(req.body.password).trim() : '';

    if (enabled && !email) {
      return res.status(400).json({ error: 'Agent email is required before granting backend access.' });
    }

    let linkedUser = null;
    if (agent.access_user_id) {
      linkedUser = await User.findByPk(agent.access_user_id);
    }
    if (!linkedUser && email) {
      linkedUser = await User.findOne({ where: { email } });
    }

    let tempPassword = null;

    if (enabled) {
      if (providedPassword && !isStrongPassword(providedPassword)) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters and contain uppercase, lowercase, and numbers.'
        });
      }

      if (!linkedUser) {
        tempPassword = providedPassword || generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        linkedUser = await User.create({
          email,
          password: hashedPassword,
          name: agent.name,
          phone: agent.phone || null,
          role: 'agent',
          is_active: true
        });
      } else {
        const updateFields = {
          role: 'agent',
          is_active: true,
          name: linkedUser.name || agent.name
        };
        if (providedPassword) {
          updateFields.password = await bcrypt.hash(providedPassword, 10);
        }
        await linkedUser.update(updateFields);
      }
    } else if (linkedUser) {
      await linkedUser.update({ is_active: false });
    }

    await agent.update({
      access_enabled: enabled,
      access_user_id: linkedUser ? linkedUser.id : agent.access_user_id,
      can_add_car: canAddCar,
      can_edit_car: canEditCar,
      can_update_order_status: canUpdateOrderStatus
    });

    const updatedAgent = await Agent.findByPk(agent.id);
    res.json({
      message: enabled ? 'Agent backend access granted.' : 'Agent backend access revoked.',
      agent: serializeAgent(updatedAgent),
      access_account: linkedUser
        ? {
          email: linkedUser.email,
          role: linkedUser.role,
          is_active: linkedUser.is_active
        }
        : null,
      temporary_password: tempPassword
    });
  } catch (error) {
    console.error('Update agent access error:', error);
    res.status(500).json({ error: 'Failed to update agent access.' });
  }
});

// ─── Admin: Delete agent ────────────────────────────────────────────────────────
router.delete('/:id', auth, authorize('seller'), async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    await agent.destroy();
    res.json({ message: 'Agent deleted successfully.' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent.' });
  }
});

module.exports = router;
