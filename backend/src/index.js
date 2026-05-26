const express = require('express');
const cors = require('cors');
const path = require('path');
const { DataTypes } = require('sequelize');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const carRoutes = require('./routes/cars');
const bidRoutes = require('./routes/bids');
const loanRoutes = require('./routes/loan');
const agentRoutes = require('./routes/agent');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');
const orderRoutes = require('./routes/orders');
const uploadRoutes = require('./routes/upload');
const bcrypt = require('bcryptjs');
const { sequelize, Car, User } = require('./models');
const { ensureSettingsSeeded } = require('./services/settingsService');

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_AGENT_AVATAR = '/uploads/default-agent-avatar.svg';

async function ensureAgentAvatarColumn() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('agents');
  if (!table.avatar_url) {
    await queryInterface.addColumn('agents', 'avatar_url', {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: DEFAULT_AGENT_AVATAR
    });
    console.log('Database migration: added agents.avatar_url');
  }
  await sequelize.query(
    `UPDATE agents
     SET avatar_url = :defaultAvatar
     WHERE avatar_url IS NULL OR TRIM(avatar_url) = ''`,
    { replacements: { defaultAvatar: DEFAULT_AGENT_AVATAR } }
  );
}

async function ensureAgentAccessColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('agents');

  if (!table.access_enabled) {
    await queryInterface.addColumn('agents', 'access_enabled', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('Database migration: added agents.access_enabled');
  }

  if (!table.access_user_id) {
    await queryInterface.addColumn('agents', 'access_user_id', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    console.log('Database migration: added agents.access_user_id');
  }

  if (!table.can_add_car) {
    await queryInterface.addColumn('agents', 'can_add_car', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    console.log('Database migration: added agents.can_add_car');
  }

  if (!table.can_edit_car) {
    await queryInterface.addColumn('agents', 'can_edit_car', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    console.log('Database migration: added agents.can_edit_car');
  }

  if (!table.can_update_order_status) {
    await queryInterface.addColumn('agents', 'can_update_order_status', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    console.log('Database migration: added agents.can_update_order_status');
  }
}

async function ensureOrderEnhancementColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('orders');

  if (!table.custom_order_type) {
    await queryInterface.addColumn('orders', 'custom_order_type', {
      type: DataTypes.STRING(100),
      allowNull: true
    });
    console.log('Database migration: added orders.custom_order_type');
  }

  if (!table.custom_vehicle) {
    await queryInterface.addColumn('orders', 'custom_vehicle', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    console.log('Database migration: added orders.custom_vehicle');
  }

  if (!table.custom_vehicle_details) {
    await queryInterface.addColumn('orders', 'custom_vehicle_details', {
      type: DataTypes.JSON,
      allowNull: true
    });
    console.log('Database migration: added orders.custom_vehicle_details');
  }

  if (!table.images) {
    await queryInterface.addColumn('orders', 'images', {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    });
    console.log('Database migration: added orders.images');
  }

  if (!table.status_steps) {
    await queryInterface.addColumn('orders', 'status_steps', {
      type: DataTypes.JSON,
      allowNull: true
    });
    console.log('Database migration: added orders.status_steps');
  }

  try {
    if (table.car_id && table.car_id.allowNull === false) {
      await queryInterface.changeColumn('orders', 'car_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'car_id',
        references: { model: 'cars', key: 'id' }
      });
      console.log('Database migration: updated orders.car_id to nullable');
    }
  } catch (error) {
    console.warn('Database migration warning: failed to update orders.car_id nullable', error?.message || error);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Prevent noisy favicon 404 in browser console
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Unified error handler (including invalid JSON payload)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  if (res.headersSent) return next(err);

  console.error('Unhandled server error:', err);
  return res.status(err.status || 500).json({ error: 'Internal server error.' });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync();
    console.log('Models synchronized.');
    await ensureAgentAvatarColumn();
    await ensureAgentAccessColumns();
    await ensureOrderEnhancementColumns();
    await ensureSettingsSeeded();
    console.log('App settings initialized.');

    const carCount = await Car.count();
    if (carCount === 0) {
      await Car.bulkCreate([
        {
          brand: 'BMW',
          model: '320i Sport',
          year: 2021,
          mileage: 25000,
          color: 'White',
          price: 185000,
          description: 'Well-maintained unit with full service record.',
          images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80'],
          status: 'available',
        },
        {
          brand: 'Mercedes-Benz',
          model: 'C200 AMG',
          year: 2022,
          mileage: 15000,
          color: 'Black',
          price: 220000,
          description: 'High specification AMG line with low mileage.',
          images: ['https://images.unsplash.com/photo-1617458047302-4f8eaaf1941a?auto=format&fit=crop&w=1000&q=80'],
          status: 'auction',
          auction_end_time: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
          starting_bid: 195000,
        },
        {
          brand: 'Toyota',
          model: 'Camry Hybrid',
          year: 2023,
          mileage: 8000,
          color: 'Silver',
          price: 145000,
          description: 'Fuel-efficient hybrid sedan in excellent condition.',
          images: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80'],
          status: 'available',
        },
        {
          brand: 'Audi',
          model: 'A4 40 TFSI',
          year: 2021,
          mileage: 30000,
          color: 'Grey',
          price: 175000,
          description: 'Comfortable executive sedan with premium features.',
          images: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'],
          status: 'auction',
          auction_end_time: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
          starting_bid: 160000,
        },
        {
          brand: 'Honda',
          model: 'Civic RS',
          year: 2022,
          mileage: 20000,
          color: 'Red',
          price: 125000,
          description: 'Sporty compact sedan with clean maintenance history.',
          images: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1000&q=80'],
          status: 'available',
        },
        {
          brand: 'Mazda',
          model: 'CX-5 2.5',
          year: 2023,
          mileage: 5000,
          color: 'Blue',
          price: 155000,
          description: 'Nearly new SUV with advanced safety package.',
          images: ['https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&w=1000&q=80'],
          status: 'available',
        },
      ]);
      console.log('Seed cars inserted.');
    }

    const defaultEmail = process.env.DEFAULT_SELLER_EMAIL || 'admin@sgautotrading.local';
    const defaultPassword = process.env.DEFAULT_SELLER_PASSWORD || 'Admin@123456';
    const existingDefaultSeller = await User.findOne({ where: { email: defaultEmail } });
    if (!existingDefaultSeller) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      await User.create({
        name: 'System Admin',
        email: defaultEmail,
        password: hashedPassword,
        role: 'seller',
      });
      console.log(`Default seller created: ${defaultEmail}`);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

startServer();
