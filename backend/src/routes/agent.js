const express = require('express');
const { Op } = require('sequelize');
const { Agent } = require('../models');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

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
      attributes: ['id', 'code', 'name', 'email', 'phone', 'company', 'address', 'is_active'],
      order: [['name', 'ASC']]
    });

    res.json({ agents });
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

    res.json({ agents, total: count });
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
    res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent.' });
  }
});

// ─── Admin: Create agent ───────────────────────────────────────────────────────
router.post('/', auth, authorize('seller'), async (req, res) => {
  try {
    const { code, name, email, phone, company, address, is_active, notes } = req.body;

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
      address: address?.trim() || null,
      is_active: is_active !== false,
      notes: notes?.trim() || null
    });

    res.status(201).json({ message: 'Agent created successfully.', agent });
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

    const { code, name, email, phone, company, address, is_active, notes } = req.body;

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
      address: address !== undefined ? (address?.trim() || null) : agent.address,
      is_active: is_active !== undefined ? Boolean(is_active) : agent.is_active,
      notes: notes !== undefined ? (notes?.trim() || null) : agent.notes
    });

    res.json({ message: 'Agent updated successfully.', agent });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent.' });
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