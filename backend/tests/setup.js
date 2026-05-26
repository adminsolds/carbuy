// Tests setup — runs once before all test suites
const { sequelize: db } = require('../src/models');
const bcrypt = require('bcryptjs');

beforeAll(async () => {
  await db.sync({ force: true });

  const { User } = require('../src/models');

  // Build app (lazy, once)
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/cars', require('../src/routes/cars'));
  app.use('/api/bids', require('../src/routes/bids'));
  app.use('/api/orders', require('../src/routes/orders'));
  app.use('/api/upload', require('../src/routes/upload'));
  app.use('/api/agent', require('../src/routes/agent'));
  app.use('/api/settings', require('../src/routes/settings'));
  app.use('/api/admin', require('../src/routes/admin'));

  // Create users
  await User.create({
    name: 'Seller User',
    email: 'seller@test.com',
    password: bcrypt.hashSync('Seller@123456', 10),
    phone: '+60 12-345 6789',
    role: 'seller',
    email_verified: true
  });

  await User.create({
    name: 'Buyer User',
    email: 'buyer@test.com',
    password: bcrypt.hashSync('Buyer@123456', 10),
    phone: '+60 11-222 3333',
    role: 'buyer',
    email_verified: true
  });

  // Login seller and buyer to get tokens
  const request = require('supertest');

  const sellerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'seller@test.com', password: 'Seller@123456' });
  const sellerToken = sellerLogin.body.token;

  const buyerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'buyer@test.com', password: 'Buyer@123456' });
  const buyerToken = buyerLogin.body.token;

  // Create test car
  const carRes = await request(app)
    .post('/api/cars')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ brand: 'Toyota', model: 'Camry', year: 2023, mileage: 5000, price: 145000, status: 'available' });
  const testCar = carRes.body.car;

  // Create test agent
  const agentRes = await request(app)
    .post('/api/agent')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ code: 'AGT001', name: 'John Agent', email: 'agent@test.com' });
  const testAgent = agentRes.body.agent;

  // Attach everything to global so all test files share the same fixtures
  global._testApp = app;
  global._sellerToken = sellerToken;
  global._buyerToken = buyerToken;
  global._testCar = testCar;
  global._testAgent = testAgent;
}, 30000);

afterAll(async () => {
  await db.close();
});
