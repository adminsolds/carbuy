const express = require('express');
const { Op } = require('sequelize');
const { User, Car, Bid } = require('../models');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// All admin routes require authentication + seller role
router.use(auth, authorize('seller'));

// GET /api/admin/users — Paginated user list with filters
router.get('/users', async (req, res) => {
  try {
    const {
      search,
      role,
      is_active,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};
    if (role && role !== 'all') where.role = role;
    if (is_active !== undefined && is_active !== 'all') {
      where.is_active = is_active === 'true' || is_active === '1';
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email', 'role'];
    const resolvedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: [
        'id', 'name', 'email', 'phone', 'role',
        'is_active', 'email_verified',
        'ic_passport', 'gender', 'company_name', 'company_phone', 'tin_number',
        'address_street', 'address_zip', 'address_city', 'address_state', 'address_country',
        'createdAt', 'updatedAt'
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[resolvedSortBy, resolvedSortOrder]]
    });

    res.json({
      users,
      total: count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sortBy: resolvedSortBy,
      sortOrder: resolvedSortOrder
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// PUT /api/admin/users/:id/role — Update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['buyer', 'seller', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Role must be buyer, seller, or agent.' });
    }

    const targetUser = await User.findByPk(id);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.id === req.user.id && role !== 'seller') {
      return res.status(400).json({ error: 'You cannot remove your own seller role.' });
    }

    await targetUser.update({ role });

    res.json({
      message: 'User role updated successfully.',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        is_active: targetUser.is_active
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// PUT /api/admin/users/:id/active — Toggle user active status
router.put('/users/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const targetUser = await User.findByPk(id);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    await targetUser.update({ is_active: Boolean(is_active) });

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        is_active: targetUser.is_active
      }
    });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// DELETE /api/admin/users/:id — Delete user (admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findByPk(id);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    await targetUser.destroy();

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/stats — Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalBuyers,
      totalSellers,
      totalAgents,
      totalCars,
      totalAvailable,
      totalAuction,
      totalSold,
      totalBids
    ] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'buyer' } }),
      User.count({ where: { role: 'seller' } }),
      User.count({ where: { role: 'agent' } }),
      Car.count({ where: { is_deleted: false } }),
      Car.count({ where: { status: 'available', is_deleted: false } }),
      Car.count({ where: { status: 'auction', is_deleted: false } }),
      Car.count({ where: { status: 'sold', is_deleted: false } }),
      Bid.count()
    ]);

    res.json({
      stats: {
        users: { total: totalUsers, buyers: totalBuyers, sellers: totalSellers, agents: totalAgents },
        cars: { total: totalCars, available: totalAvailable, auction: totalAuction, sold: totalSold },
        bids: { total: totalBids }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

module.exports = router;
