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

const STATUS_STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
const STATUS_STEP_MAX_LEN = 200;
const STEP_TO_ORDER_STATUS = {
  step1: 'pending',
  step2: 'deposit_paid',
  step3: 'paid',
  step4: 'processing',
  step5: 'shipped',
  step6: 'completed'
};
const ORDER_STATUS_TO_STEP = {
  pending: 'step1',
  deposit_paid: 'step2',
  paid: 'step3',
  processing: 'step4',
  shipped: 'step5',
  delivered: 'step6',
  completed: 'step6'
};

const emptyStatusSteps = () => ({
  step1: '',
  step2: '',
  step3: '',
  step4: '',
  step5: '',
  step6: '',
  active_step: ''
});

const normalizeActiveStep = (value) => {
  const step = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!step) return '';
  return Object.prototype.hasOwnProperty.call(STEP_TO_ORDER_STATUS, step) ? step : null;
};

const normalizeStatusSteps = (value, { allowPartial = false } = {}) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return allowPartial ? {} : emptyStatusSteps();
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return allowPartial ? {} : emptyStatusSteps();
  }

  const output = allowPartial ? {} : emptyStatusSteps();
  for (const key of STATUS_STEP_KEYS) {
    if (allowPartial && !Object.prototype.hasOwnProperty.call(value, key)) continue;
    const raw = value[key];
    const text = raw == null ? '' : String(raw).trim();
    if (text.length > STATUS_STEP_MAX_LEN) {
      throw new Error(`${key} must be ${STATUS_STEP_MAX_LEN} characters or less.`);
    }
    output[key] = text;
  }
  if (allowPartial) {
    if (Object.prototype.hasOwnProperty.call(value, 'active_step')) {
      const normalizedActiveStep = normalizeActiveStep(value.active_step);
      if (normalizedActiveStep === null) {
        throw new Error('active_step must be one of step1, step2, step3, step4, step5, step6.');
      }
      output.active_step = normalizedActiveStep;
    }
  } else {
    const normalizedActiveStep = normalizeActiveStep(value.active_step);
    if (normalizedActiveStep === null) {
      throw new Error('active_step must be one of step1, step2, step3, step4, step5, step6.');
    }
    output.active_step = normalizedActiveStep || '';
    if (!output.active_step) {
      for (let i = STATUS_STEP_KEYS.length - 1; i >= 0; i -= 1) {
        const key = STATUS_STEP_KEYS[i];
        if (output[key]) {
          output.active_step = key;
          break;
        }
      }
    }
  }
  return output;
};

const resolveOrderStatusFromSteps = (statusSteps) => {
  let activeStep = normalizeActiveStep(statusSteps?.active_step);
  if (!activeStep && statusSteps && typeof statusSteps === 'object') {
    for (let i = STATUS_STEP_KEYS.length - 1; i >= 0; i -= 1) {
      const key = STATUS_STEP_KEYS[i];
      const text = typeof statusSteps[key] === 'string' ? statusSteps[key].trim() : '';
      if (text) {
        activeStep = key;
        break;
      }
    }
  }
  if (!activeStep) return null;
  return STEP_TO_ORDER_STATUS[activeStep] || null;
};

const buildStatusStepsFromLegacyStatus = (legacyStatus) => {
  const normalized = normalizeText(legacyStatus)?.toLowerCase();
  const step = normalized ? ORDER_STATUS_TO_STEP[normalized] : null;
  if (!step) return emptyStatusSteps();
  const output = emptyStatusSteps();
  output[step] = normalized.replace(/_/g, ' ');
  output.active_step = step;
  return output;
};

// Generate unique order number
const generateOrderNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${dateStr}-${random}`;
};

const normalizeImageUrls = (value, max = 5) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item && item.length <= 500)
    .slice(0, max);
};

const resolveOrderTypePayload = ({ order_type, custom_order_type }) => {
  const normalizedType = ['purchase', 'auction_win', 'custom'].includes(order_type) ? order_type : 'purchase';
  const normalizedCustomType = normalizeText(custom_order_type);
  if (normalizedType === 'custom' && !normalizedCustomType) {
    return { error: 'Custom order type is required when order type is custom.' };
  }
  return {
    order_type: normalizedType,
    custom_order_type: normalizedType === 'custom' ? normalizedCustomType : null
  };
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

const CUSTOM_VEHICLE_DETAIL_FIELDS = {
  brand: 80,
  model: 80,
  year: 20,
  color: 40,
  steering: 40,
  repaired: 80,
  transmission: 40,
  cc: 20,
  drive: 40,
  fuel: 40,
  mileage: 40
};


const normalizeCustomVehicleDetails = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const details = {};
  for (const [key, maxLen] of Object.entries(CUSTOM_VEHICLE_DETAIL_FIELDS)) {
    const raw = value[key];
    const text = raw == null ? '' : String(raw).trim();
    if (text.length > maxLen) {
      throw new Error(`custom_vehicle_details.${key} must be ${maxLen} characters or less.`);
    }
    details[key] = text;
  }
  const hasAnyValue = Object.values(details).some(Boolean);
  return hasAnyValue ? details : null;
};

const buildCustomVehicleLabel = (customVehicle, details) => {
  const direct = normalizeText(customVehicle);
  if (direct) return direct.slice(0, 255);
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const brand = typeof details.brand === 'string' ? details.brand.trim() : '';
  const model = typeof details.model === 'string' ? details.model.trim() : '';
  const year = typeof details.year === 'string' ? details.year.trim() : '';
  const title = [brand, model, year].filter(Boolean).join(' ');
  if (title) return title.slice(0, 255);
  return 'Custom Vehicle';
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
  order_type: order.order_type,
  custom_order_type: order.custom_order_type,
  custom_vehicle: order.custom_vehicle,
  custom_vehicle_details: (() => {
    try {
      return normalizeCustomVehicleDetails(order.custom_vehicle_details) || null;
    } catch {
      return null;
    }
  })(),
  order_type_label: order.order_type === 'custom' ? (order.custom_order_type || 'custom') : order.order_type,
  vehicle_label: buildCustomVehicleLabel(order.custom_vehicle, order.custom_vehicle_details) || (order.car ? `${order.car.brand} ${order.car.model}` : null),
  images: Array.isArray(order.images) ? order.images : [],
  status_steps: normalizeStatusSteps(order.status_steps),
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
    const { car_id, order_type, custom_order_type, amount, delivery_address, agent_id, images, status_steps } = req.body;
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
    const orderTypePayload = resolveOrderTypePayload({ order_type, custom_order_type });
    if (orderTypePayload.error) {
      return res.status(400).json({ error: orderTypePayload.error });
    }
    const orderImages = normalizeImageUrls(images, 5);
    let resolvedStatusSteps = emptyStatusSteps();
    try {
      resolvedStatusSteps = normalizeStatusSteps(status_steps);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    const resolvedOrderStatus = resolveOrderStatusFromSteps(resolvedStatusSteps) || 'pending';

    const order = await Order.create({
      order_no: generateOrderNo(),
      user_id,
      car_id,
      agent_id: agent_id || null,
      order_type: orderTypePayload.order_type,
      custom_order_type: orderTypePayload.custom_order_type,
      custom_vehicle: null,
      custom_vehicle_details: null,
      images: orderImages,
      status_steps: resolvedStatusSteps,
      amount: Number(amount),
      deposit_paid: 0,
      status: resolvedOrderStatus,
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
      car_id, custom_vehicle, order_type, custom_order_type, amount, buyer_name, buyer_email, buyer_phone,
      delivery_address, agent_id, notes, images, custom_vehicle_details, status_steps, status
    } = req.body;

    const normalizedCustomVehicle = normalizeText(custom_vehicle);
    let normalizedCustomVehicleDetails = null;
    try {
      normalizedCustomVehicleDetails = normalizeCustomVehicleDetails(custom_vehicle_details);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    const resolvedCustomVehicleLabel = buildCustomVehicleLabel(normalizedCustomVehicle, normalizedCustomVehicleDetails);
    if ((!car_id && !resolvedCustomVehicleLabel) || !amount || !buyer_name) {
      return res.status(400).json({ error: 'Vehicle (or custom vehicle), amount, and buyer name are required.' });
    }

    const hasCarSelection = Boolean(car_id);
    let car = null;
    if (hasCarSelection) {
      car = await Car.findByPk(car_id);
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
    const orderTypePayload = resolveOrderTypePayload({ order_type, custom_order_type });
    if (orderTypePayload.error) {
      return res.status(400).json({ error: orderTypePayload.error });
    }
    const orderImages = normalizeImageUrls(images, 5);
    let resolvedStatusSteps = emptyStatusSteps();
    if (status_steps !== undefined) {
      try {
        resolvedStatusSteps = normalizeStatusSteps(status_steps);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }
    } else if (status !== undefined) {
      resolvedStatusSteps = buildStatusStepsFromLegacyStatus(status);
    }
    const resolvedOrderStatus = resolveOrderStatusFromSteps(resolvedStatusSteps) || 'pending';

    const order = await Order.create({
      order_no: generateOrderNo(),
      user_id: linkedUser.id,
      car_id: hasCarSelection ? Number(car_id) : null,
      agent_id: agent_id || null,
      order_type: orderTypePayload.order_type,
      custom_order_type: orderTypePayload.custom_order_type,
      custom_vehicle: hasCarSelection ? null : resolvedCustomVehicleLabel,
      custom_vehicle_details: hasCarSelection ? null : normalizedCustomVehicleDetails,
      images: orderImages,
      status_steps: resolvedStatusSteps,
      amount: Number(amount),
      deposit_paid: 0,
      status: resolvedOrderStatus,
      buyer_name: snapshotBuyerName,
      buyer_email: snapshotBuyerEmail,
      buyer_phone: snapshotBuyerPhone,
      delivery_address: normalizeText(delivery_address),
      notes: normalizeText(notes),
    });

    // Mark car as sold only for inventory-linked orders
    if (car) {
      await car.update({ status: 'sold' });
    }

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
    const orderNo = normalizeText(req.query.order_no);
    const { status } = req.query;
    const inferredOrderNo = !orderNo && account && /^ord-/i.test(account) ? account : null;
    const effectiveOrderNo = orderNo || inferredOrderNo;

    if (!account && !effectiveOrderNo) {
      return res.status(400).json({ error: 'Account or order number is required.' });
    }

    const conditions = [];
    const hasOrderNo = Boolean(effectiveOrderNo);
    if (account && !hasOrderNo) {
      const accountLower = account.toLowerCase();
      const accountSnapshotCondition = {
        [Op.or]: [
          where(fn('lower', col('buyer_email')), accountLower),
          { buyer_phone: account },
          where(fn('lower', col('buyer_name')), accountLower)
        ]
      };
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
        conditions.push(accountSnapshotCondition);
      } else {
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

        conditions.push({
          [Op.or]: [
            { user_id: user.id },
            ...(currentEmail ? [where(fn('lower', col('buyer_email')), currentEmail)] : []),
            accountSnapshotCondition
          ]
        });
      }
    }

    if (effectiveOrderNo) {
      const orderNoLower = effectiveOrderNo.toLowerCase();
      conditions.push(where(fn('lower', col('order_no')), { [Op.like]: `%${orderNoLower}%` }));
    }

    if (status && status !== 'all') {
      conditions.push({ status });
    }

    const orderWhere = conditions.length > 1 ? { [Op.and]: conditions } : conditions[0];

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
router.put('/:id/status-steps', auth, authorize('seller', 'agent'), agentPermission('update_order_status'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    let nextSteps;
    try {
      nextSteps = normalizeStatusSteps(req.body?.status_steps);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const updateData = { status_steps: nextSteps };
    const nextStatus = resolveOrderStatusFromSteps(nextSteps);
    if (nextStatus) {
      updateData.status = nextStatus;
      if (nextStatus === 'paid' && !order.paid_at) updateData.paid_at = new Date();
      if (nextStatus === 'completed' && !order.delivered_at) updateData.delivered_at = new Date();
    }
    await order.update(updateData);

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Car, as: 'car', attributes: ['id', 'brand', 'model', 'year', 'price'] },
        { model: Agent, as: 'agent', attributes: ['id', 'code', 'name'] }
      ]
    });

    res.json({ message: 'Order step status updated.', order: serializeOrder(updated) });
  } catch (error) {
    console.error('Update order status steps error:', error);
    res.status(500).json({ error: 'Failed to update order step status.' });
  }
});

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
      agent_id, delivery_address, notes, custom_vehicle, custom_order_type, images, status_steps, custom_vehicle_details
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

    let resolvedStatusSteps = normalizeStatusSteps(order.status_steps);
    if (status_steps !== undefined) {
      try {
        resolvedStatusSteps = normalizeStatusSteps(status_steps);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }
    }

    let resolvedCustomVehicleDetails = order.custom_vehicle_details;
    if (custom_vehicle_details !== undefined) {
      try {
        resolvedCustomVehicleDetails = normalizeCustomVehicleDetails(custom_vehicle_details);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }
    }
    const resolvedCustomVehicleLabel = custom_vehicle !== undefined
      ? buildCustomVehicleLabel(custom_vehicle, resolvedCustomVehicleDetails)
      : buildCustomVehicleLabel(order.custom_vehicle, resolvedCustomVehicleDetails);
    const resolvedOrderStatus = resolveOrderStatusFromSteps(resolvedStatusSteps);

    const updateData = {
      user_id: linkedUser.id,
      buyer_name: nextBuyerName,
      buyer_email: nextBuyerEmail,
      buyer_phone: nextBuyerPhone,
      custom_vehicle: resolvedCustomVehicleLabel,
      custom_vehicle_details: resolvedCustomVehicleDetails,
      custom_order_type: custom_order_type !== undefined ? normalizeText(custom_order_type) : order.custom_order_type,
      images: images !== undefined ? normalizeImageUrls(images, 5) : (Array.isArray(order.images) ? order.images : []),
      amount: amount !== undefined ? Number(amount) : order.amount,
      deposit_paid: deposit_paid !== undefined ? Number(deposit_paid) : order.deposit_paid,
      agent_id: agent_id !== undefined ? (agent_id ? Number(agent_id) : null) : order.agent_id,
      delivery_address: delivery_address !== undefined ? normalizeText(delivery_address) : order.delivery_address,
      notes: notes !== undefined ? normalizeText(notes) : order.notes,
      status_steps: resolvedStatusSteps
    };
    if (resolvedOrderStatus) {
      updateData.status = resolvedOrderStatus;
      if (resolvedOrderStatus === 'paid' && !order.paid_at) updateData.paid_at = new Date();
      if (resolvedOrderStatus === 'completed' && !order.delivered_at) updateData.delivered_at = new Date();
    }

    await order.update(updateData);

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
