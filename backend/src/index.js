const express = require('express');
const cors = require('cors');
const path = require('path');
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

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync();
    console.log('Models synchronized.');
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
