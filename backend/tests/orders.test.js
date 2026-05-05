const request = require('supertest');
const fixtures = require('./fixtures');
let app;
let sellerToken;
let buyerToken;
let testAgent;
let carCounter = 0;

beforeAll(() => {
  app = fixtures.app;
  sellerToken = fixtures.sellerToken;
  buyerToken = fixtures.buyerToken;
  testAgent = fixtures.testAgent;
});

async function createAvailableCar() {
  carCounter += 1;
  const res = await request(app)
    .post('/api/cars')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      brand: 'TestBrand',
      model: `Model-${carCounter}`,
      year: 2022,
      mileage: 12000 + carCounter,
      price: 100000 + carCounter,
      status: 'available'
    });
  return res.body.car;
}

describe('Orders API', () => {
  describe('POST /api/orders/admin', () => {
    it('should create order as seller', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Test Buyer',
          buyer_email: 'buyer@test.com',
          buyer_phone: '+60 12-345 6789',
          agent_id: testAgent.id,
          delivery_address: '123 Test St, Kuala Lumpur',
          notes: 'Test order'
        });
      expect(res.status).toBe(201);
      expect(res.body.order).toHaveProperty('order_no');
      expect(res.body.order).toHaveProperty('status', 'pending');
      expect(res.body.order.buyer_name).toBe('Buyer User');
    });

    it('should mark car as sold after order creation', async () => {
      const carRes = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ brand: 'Subaru', model: 'Outback', year: 2022, mileage: 15000, price: 165000, status: 'available' });
      const car = carRes.body.car;

      await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: car.id, order_type: 'purchase', amount: 165000, buyer_name: 'Buyer 2' });

      const carCheck = await request(app).get(`/api/cars/${car.id}`);
      expect(carCheck.body.car.status).toBe('sold');
    });

    it('should reject duplicate active order for same car', async () => {
      const testCar = await createAvailableCar();
      const first = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: testCar.id, order_type: 'purchase', amount: 130000, buyer_name: 'First Buyer' });
      expect(first.status).toBe(201);

      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: testCar.id, order_type: 'purchase', amount: 130000, buyer_name: 'Another Buyer' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/active|already|exists/i);
    });

    it('should reject order without required fields', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: testCar.id, amount: 130000 });
      expect(res.status).toBe(400);
    });

    it('should reject order for non-existent car', async () => {
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: 99999, order_type: 'purchase', amount: 100000, buyer_name: 'Buyer' });
      expect(res.status).toBe(404);
    });

    it('should reject order as buyer', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ car_id: testCar.id, order_type: 'purchase', amount: 130000, buyer_name: 'Buyer' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/orders/admin/list', () => {
    it('should list orders for seller', async () => {
      const res = await request(app)
        .get('/api/orders/admin/list')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should reject list request as buyer', async () => {
      const res = await request(app)
        .get('/api/orders/admin/list')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/orders/admin/list?status=pending')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      res.body.orders.forEach(o => expect(o.status).toBe('pending'));
    });
  });

  describe('GET /api/orders/me', () => {
    it('should return admin-created order linked by buyer email', async () => {
      const carRes = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ brand: 'Nissan', model: 'Teana', year: 2020, mileage: 32000, price: 88000, status: 'available' });
      const car = carRes.body.car;

      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: car.id,
          order_type: 'purchase',
          amount: 88000,
          buyer_name: 'Any Snapshot Name',
          buyer_email: 'BUYER@test.com'
        });
      expect(createRes.status).toBe(201);

      const myOrdersRes = await request(app)
        .get('/api/orders/me')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(myOrdersRes.status).toBe(200);
      const matched = (myOrdersRes.body.orders || []).find((o) => o.id === createRes.body.order.id);
      expect(matched).toBeTruthy();
      expect(matched.user).toBeTruthy();
      expect(matched.user.email).toBe('buyer@test.com');
      expect(matched.buyer_email).toBe('buyer@test.com');
      expect(matched.buyer_name).toBe('Buyer User');
    });
  });

  describe('GET /api/orders/admin/stats', () => {
    it('should return order statistics', async () => {
      const res = await request(app)
        .get('/api/orders/admin/stats')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.stats).toHaveProperty('total');
      expect(res.body.stats).toHaveProperty('total_revenue');
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('should update order buyer info and deposit', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Original Buyer',
          buyer_email: 'original@test.com'
        });
      const order = createRes.body.order;

      const res = await request(app)
        .put(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          buyer_name: 'Updated Buyer',
          buyer_email: 'updated@test.com',
          deposit_paid: 30000
        });
      expect(res.status).toBe(200);
      expect(res.body.order.buyer_name).toBe('Updated Buyer');
      expect(res.body.order.deposit_paid).toBe(30000);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should transition pending -> deposit_paid', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Status Test Buyer'
        });
      const order = createRes.body.order;

      const res = await request(app)
        .put(`/api/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'deposit_paid' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('deposit_paid');
    });

    it('should reject invalid status transition', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Invalid Transition Buyer'
        });
      const order = createRes.body.order;

      const res = await request(app)
        .put(`/api/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'delivered' });
      expect(res.status).toBe(400);
    });

    it('should release car when cancelled', async () => {
      const carRes = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ brand: 'Ford', model: 'Focus', year: 2021, mileage: 22000, price: 95000, status: 'available' });
      const car = carRes.body.car;

      const orderRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ car_id: car.id, order_type: 'purchase', amount: 95000, buyer_name: 'Cancel Test' });
      const order = orderRes.body.order;

      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'cancelled' });

      const carCheck = await request(app).get(`/api/cars/${car.id}`);
      expect(carCheck.body.car.status).toBe('available');
    });
  });
});
