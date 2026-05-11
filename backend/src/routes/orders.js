const express = require('express');
const { Op, fn, col, where } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Order, User, Car, Agent } = require('../models');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const agentPermission = require('../middleware/agentPermission');

const router = express.Router();

// Valid order status transitions
const VALID_TRANSITIONS = {
  pending: ['deposit_paid', 'cancelled'],
  deposit_paid: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: ['refunded'],
  refunded: []
};

// Generate unique order number
const generateOrderNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${dateStr}-${random}`;
};

const generatePickupCode = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PK-${random}`;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email || null;
};

const normalizeText = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
};

const resolveUserByBuyer = async ({ buyerEmail }) => {
  const normalizedEmail = normalizeEmail(buyerEmail);
  if (!normalizedEmail) return null;
  return User.findOne({
    where: where(fn('lower', col('email')), normalizedEmail)
  });
};

const buildGuestEmail = () => `guest-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@sgautotrading.local`;

const ensureBuyerUser = async ({ buyerName, buyerEmail, buyerPhone, fallbackUserId = null }) => {
  const normalizedEmail = normalizeEmail(buyerEmail);
  const normalizedName = normalizeText(buyerName) || 'Guest Buyer';
  const normalizedPhone = normalizeText(buyerPhone);

  if (normalizedEmail) {
    const existing = await resolveUserByBuyer({ buyerEmail: normalizedEmail });
    if (existing) return existing;
  } else if (fallbackUserId) {
    const fallbackUser = await User.findByPk(fallbackUserId);
    if (fallbackUser) return fallbackUser;
  }

  const passwordSeed = `Guest@${Math.random().toString(36).slice(2, 12)}A1`;
  const hashedPassword = await bcrypt.hash(passwordSeed, 10);

  return User.create({
    email: normalizedEmail || buildGuestEmail(),
    password: hashedPassword,
    name: normalizedName,
    phone: normalizedPhone || null,
    role: 'buyer',
  });
};

// ─── Helper: serialize order ─────────────────────────────────────────────────
const serializeOrder = (order) => ({
  id: order.id,
  order_no: order.order_no,
  pickup_code: order.pickup_code,
  order_type: order.order_type,
  amount: order.amount,
  deposit_paid: order.deposit_paid,
  status: order.status,
  buyer_name: order.buyer_name,
  buyer_email: order.buyer_email,
  buyer_phone: order.buyer_phone,
  delivery_address: order.delivery_address,
  notes: order.notes,
  paid_at: order.paid_at,
  delivered_at: order.delivered_at,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  user: order.user ? {
    id: order.user.id,
    name: order.user.name,
    email: order.user.email
  } : null,
  car: order.car ? {
    id: order.car.id,
    brand: order.car.brand,
    model: order.car.model,
    year: order.car.year,
    price: order.car.price
  } : null,
  agent: order.agent ? {
    id: order.agent.id,
    code: order.agent.code,
    name: order.agent.name
  } : null
});

// ─── POST /api/orders — Create order (frontend: buy a car) ─────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { car_id, order_type, amount, delivery_address, agent_id } = req.body;
    const user_id = req.user.id;

    if (!car_id || !amount) {
      return res.status(400).json({ error: 'Car ID and amount are required.' });
    }

    const car = await Car.findByPk(car_id);
    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    // Check for existing active order for same car
    const existingOrder = await Order.findOne({
      where: {
        car_id,
        status: { [Op.notIn]: ['cancelled', 'refunded', 'completed'] }
      }
    });
    if (existingOrder) {
      return res.status(400).json({ error: 'An active order already exists for this vehicle.' });
    }

    const user = await User.findByPk(user_id);

    const order = await Order.create({
      order_no: generateOrderNo(),
      pickup_code: generatePickupCode(),
      user_id,
      car_id,
      agent_id: agent_id || null,
      order_type: ['purchase', 'auction_win'].includes(order_type) ? order_type : 'purchase',
      amount: Number(amount),
      deposit_paid: 0,
      status: 'pending',
      buyer_name: user.name,
      buyer_email: user.email,
      buyer_phone: user.phone,
      delivery_address: delivery_address || null
    });

    // Mark car as sold
    await car.update({ status: 'sold' });

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ]
    });

    res.status(201).json({ message: 'Order created successfully.', order: serializeOrder(fullOrder) });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

// ─── POST /api/orders/admin — Create order by admin (offline transaction) ────────
router.post('/admin', auth, authorize('seller'), async (req, res) => {
  try {
    const {
      car_id, order_type, amount, buyer_name, buyer_email, buyer_phone,
      delivery_address, agent_id, notes
    } = req.body;

    if (!car_id || !amount || !buyer_name) {
      return res.status(400).json({ error: 'Car ID, amount, and buyer name are required.' });
    }

    const car = await Car.findByPk(car_id);
    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    // Check for existing active order for same car
    const existingOrder = await Order.findOne({
      where: {
        car_id,
        status: { [Op.notIn]: ['cancelled', 'refunded', 'completed'] }
      }
    });
    if (existingOrder) {
      return res.status(400).json({ error: 'An active order already exists for this vehicle.' });
    }

    const buyerNameInput = normalizeText(buyer_name);
    const buyerEmailInput = normalizeEmail(buyer_email);
    const buyerPhoneInput = normalizeText(buyer_phone);
    const linkedUser = await ensureBuyerUser({
      buyerName: buyerNameInput,
      buyerEmail: buyerEmailInput,
      buyerPhone: buyerPhoneInput
    });

    const snapshotBuyerName = linkedUser?.name || buyerNameInput;
    const snapshotBuyerEmail = linkedUser?.email || buyerEmailInput;
    const snapshotBuyerPhone = buyerPhoneInput || linkedUser?.phone || null;

    const order = await Order.create({
      order_no: generateOrderNo(),
      pickup_code: generatePickupCode(),
      user_id: linkedUser.id,
      car_id,
      agent_id: agent_id || null,
      order_type: ['purchase', 'auction_win'].includes(order_type) ? order_type : 'purchase',
      amount: Number(amount),
      deposit_paid: 0,
      status: 'pending',
      buyer_name: snapshotBuyerName,
      buyer_email: snapshotBuyerEmail,
      buyer_phone: snapshotBuyerPhone,
      delivery_address: normalizeText(delivery_address),
      notes: normalizeText(notes),
    });

    // Mark car as sold
    await car.update({ status: 'sold' });

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ]
    });

    res.status(201).json({ message: 'Order created successfully.', order: serializeOrder(fullOrder) });
  } catch (error) {
    console.error('Admin create order error:', error);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

// ─── GET /api/orders/me — Current user's orders ─────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const currentUser = await User.findByPk(req.user.id, { attributes: ['id', 'email'] });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentEmail = normalizeEmail(currentUser.email);

    // Auto-bind historical orders created by admin with matching buyer email.
    if (currentEmail) {
      await Order.update(
        { user_id: currentUser.id },
        {
          where: {
            user_id: null,
            [Op.and]: [where(fn('lower', col('buyer_email')), currentEmail)]
          }
        }
      );
    }

    const orderWhere = {
      [Op.or]: [
        { user_id: currentUser.id },
        ...(currentEmail ? [where(fn('lower', col('buyer_email')), currentEmail)] : [])
      ]
    };
    if (status && status !== 'all') orderWhere.status = status;

    const orders = await Order.findAll({
      where: orderWhere,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'images'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ─── Admin: List orders (paginated) ────────────────────────────────────────────
// Public: lookup orders by account (email/phone/name)
router.get('/lookup', async (req, res) => {
  try {
    const account = normalizeText(req.query.account);
    const { status } = req.query;

    if (!account) {
      return res.status(400).json({ error: 'Account is required.' });
    }

    const accountLower = account.toLowerCase();
    const user = await User.findOne({
      where: {
        [Op.or]: [
          where(fn('lower', col('email')), accountLower),
          { phone: account },
          where(fn('lower', col('name')), accountLower)
        ]
      },
      attributes: ['id', 'email']
    });

    if (!user) {
      return res.json({ orders: [] });
    }

    const currentEmail = normalizeEmail(user.email);

    if (currentEmail) {
      await Order.update(
        { user_id: user.id },
        {
          where: {
            user_id: null,
            [Op.and]: [where(fn('lower', col('buyer_email')), currentEmail)]
          }
        }
      );
    }

    const orderWhere = {
      [Op.or]: [
        { user_id: user.id },
        ...(currentEmail ? [where(fn('lower', col('buyer_email')), currentEmail)] : [])
      ]
    };
    if (status && status !== 'all') orderWhere.status = status;

    const orders = await Order.findAll({
      where: orderWhere,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'images'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    console.error('Lookup orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

router.get('/admin/list', auth, authorize('seller', 'agent'), async (req, res) => {
  try {
    const {
      search, status, order_type,
      limit = 20, offset = 0,
      sortBy = 'createdAt', sortOrder = 'DESC'
    } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (order_type && order_type !== 'all') where.order_type = order_type;

    if (search) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${search}%` } },
        { buyer_name: { [Op.like]: `%${search}%` } },
        { buyer_email: { [Op.like]: `%${search}%` } }
      ];
    }

    const allowedSort = ['createdAt', 'updatedAt', 'amount', 'status', 'order_no'];
    const resolvedSort = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price', 'status'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[resolvedSort, resolvedOrder]]
    });

    res.json({
      orders: orders.map(serializeOrder),
      total: count
    });
  } catch (error) {
    console.error('Admin list orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ─── Admin: Get single order ──────────────────────────────────────────────────
router.get('/:id', auth, authorize('seller', 'agent'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Car, as: 'car' },
        { model: Agent, as: 'agent' }
      ]
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order: serializeOrder(order) });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order.' });
  }
});

// ─── Admin: Update order status ───────────────────────────────────────────────
router.put('/:id/status', auth, authorize('seller', 'agent'), agentPermission('update_order_status'), async (req, res) => {
  try {
    const { status: newStatus, notes } = req.body;
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from '${order.status}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`
      });
    }

    const updateData = { status: newStatus };
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    // Set timestamps
    if (newStatus === 'paid') updateData.paid_at = new Date();
    if (newStatus === 'delivered') updateData.delivered_at = new Date();

    await order.update(updateData);

    // If cancelled, release the car back to available
    if (newStatus === 'cancelled') {
      await Car.update({ status: 'available' }, { where: { id: order.car_id } });
    }
    // If refunded, release car back to available
    if (newStatus === 'refunded') {
      await Car.update({ status: 'available' }, { where: { id: order.car_id } });
    }

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ]
    });

    res.json({ message: `Order status updated to '${newStatus}'.`, order: serializeOrder(updated) });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// ─── Admin: Update order ────────────────────────────────────────────────────────
router.put('/:id', auth, authorize('seller'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const {
      buyer_name, buyer_email, buyer_phone, amount, deposit_paid,
      agent_id, delivery_address, notes
    } = req.body;

    const nextBuyerNameInput = buyer_name !== undefined ? normalizeText(buyer_name) : order.buyer_name;
    const nextBuyerEmailInput = buyer_email !== undefined ? normalizeEmail(buyer_email) : normalizeEmail(order.buyer_email);
    const nextBuyerPhoneInput = buyer_phone !== undefined ? normalizeText(buyer_phone) : order.buyer_phone;
    const linkedUser = await ensureBuyerUser({
      buyerName: nextBuyerNameInput,
      buyerEmail: nextBuyerEmailInput,
      buyerPhone: nextBuyerPhoneInput,
      fallbackUserId: order.user_id
    });

    const nextBuyerName = linkedUser?.name || nextBuyerNameInput;
    const nextBuyerEmail = linkedUser?.email || nextBuyerEmailInput;
    const nextBuyerPhone = buyer_phone !== undefined
      ? normalizeText(buyer_phone)
      : (order.buyer_phone || linkedUser?.phone || null);

    await order.update({
      user_id: linkedUser.id,
      buyer_name: nextBuyerName,
      buyer_email: nextBuyerEmail,
      buyer_phone: nextBuyerPhone,
      amount: amount !== undefined ? Number(amount) : order.amount,
      deposit_paid: deposit_paid !== undefined ? Number(deposit_paid) : order.deposit_paid,
      agent_id: agent_id !== undefined ? (agent_id ? Number(agent_id) : null) : order.agent_id,
      delivery_address: delivery_address !== undefined ? normalizeText(delivery_address) : order.delivery_address,
      notes: notes !== undefined ? normalizeText(notes) : order.notes
    });

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ]
    });

    res.json({ message: 'Order updated.', order: serializeOrder(updated) });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

// ─── Admin: Get order stats ─────────────────────────────────────────────────────
router.get('/admin/stats', auth, authorize('seller', 'agent'), async (req, res) => {
  try {
    const [
      total, pending, deposit_paid, paid, processing,
      shipped, delivered, completed, cancelled
    ] = await Promise.all([
      Order.count(),
      Order.count({ where: { status: 'pending' } }),
      Order.count({ where: { status: 'deposit_paid' } }),
      Order.count({ where: { status: 'paid' } }),
      Order.count({ where: { status: 'processing' } }),
      Order.count({ where: { status: 'shipped' } }),
      Order.count({ where: { status: 'delivered' } }),
      Order.count({ where: { status: 'completed' } }),
      Order.count({ where: { status: 'cancelled' } })
    ]);

    const totalRevenue = await Order.sum('amount', {
      where: { status: { [Op.notIn]: ['cancelled', 'refunded', 'pending'] } }
    });

    res.json({
      stats: {
        total,
        by_status: { pending, deposit_paid, paid, processing, shipped, delivered, completed, cancelled },
        total_revenue: Number(totalRevenue || 0)
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics.' });
  }
});

module.exports = router;
