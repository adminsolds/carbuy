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

    it('should create custom-vehicle order with detailed specs', async () => {
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          order_type: 'custom',
          custom_order_type: 'booking',
          custom_vehicle_details: {
            brand: 'Toyota',
            model: 'Harrier',
            year: '2021',
            color: 'White',
            steering: 'Right',
            repaired: 'No',
            transmission: 'AT',
            cc: '2000',
            drive: '2WD',
            fuel: 'Petrol',
            mileage: '35000'
          },
          status_steps: {
            step1: 'Booking confirmed',
            step2: 'Loan submission in progress',
            step3: '',
            step4: '',
            step5: '',
            step6: ''
          },
          amount: 145000,
          buyer_name: 'Custom Vehicle Buyer'
        });
      expect(res.status).toBe(201);
      expect(res.body.order.custom_vehicle_details).toBeTruthy();
      expect(res.body.order.custom_vehicle_details.brand).toBe('Toyota');
      expect(res.body.order.vehicle_label).toMatch(/Toyota/i);
      expect(res.body.order.status_steps.step1).toBe('Booking confirmed');
      expect(res.body.order.status_steps.step2).toBe('Loan submission in progress');
      expect(res.body.order.status_steps.active_step).toBe('step2');
      expect(res.body.order.status).toBe('deposit_paid');
    });

    it('should accept status_steps as JSON string payload', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 132000,
          buyer_name: 'String Step Buyer',
          status_steps: JSON.stringify({
            step1: 'Booked',
            step2: 'Deposit received',
            step3: '',
            step4: '',
            step5: '',
            step6: ''
          })
        });
      expect(res.status).toBe(201);
      expect(res.body.order.status_steps.step2).toBe('Deposit received');
      expect(res.body.order.status_steps.active_step).toBe('step2');
      expect(res.body.order.status).toBe('deposit_paid');
    });

    it('should map legacy status field to step status when status_steps is missing', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 133000,
          buyer_name: 'Legacy Status Buyer',
          status: 'paid'
        });
      expect(res.status).toBe(201);
      expect(res.body.order.status_steps.active_step).toBe('step3');
      expect(res.body.order.status).toBe('paid');
    });

    it('should create unpaid order without exposing status flow', async () => {
      const testCar = await createAvailableCar();
      const res = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 134000,
          buyer_name: 'Unpaid Buyer',
          payment_confirmed: false,
          status_steps: {
            step1: 'Should stay hidden',
            step2: '',
            step3: '',
            step4: '',
            step5: '',
            step6: ''
          }
        });
      expect(res.status).toBe(201);
      expect(res.body.order.payment_confirmed).toBe(false);
      expect(res.body.order.status_label).toBe('Order Processing');
      expect(res.body.order.can_edit_status_steps).toBe(false);
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

  describe('GET /api/orders/lookup', () => {
    it('should return orders by account without login', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 88000,
          buyer_name: 'Lookup Buyer',
          buyer_email: 'buyer@test.com'
        });
      expect(createRes.status).toBe(201);

      const lookupRes = await request(app)
        .get('/api/orders/lookup')
        .query({ account: 'buyer@test.com' });

      expect(lookupRes.status).toBe(200);
      const matched = (lookupRes.body.orders || []).find((o) => o.id === createRes.body.order.id);
      expect(matched).toBeTruthy();
      expect(matched.user).toBeTruthy();
      expect(matched.user.email).toBe('buyer@test.com');
    });

    it('should return order by order number without account', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 99000,
          buyer_name: 'OrderNo Buyer'
        });
      expect(createRes.status).toBe(201);
      const orderNo = createRes.body.order.order_no;

      const lookupRes = await request(app)
        .get('/api/orders/lookup')
        .query({ order_no: orderNo });

      expect(lookupRes.status).toBe(200);
      expect(Array.isArray(lookupRes.body.orders)).toBe(true);
      expect(lookupRes.body.orders.length).toBeGreaterThan(0);
      expect(lookupRes.body.orders[0].order_no).toBe(orderNo);
    });

    it('should still return order when order number is correct but account is wrong', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 102000,
          buyer_name: 'Mixed Lookup Buyer'
        });
      expect(createRes.status).toBe(201);
      const orderNo = createRes.body.order.order_no;

      const lookupRes = await request(app)
        .get('/api/orders/lookup')
        .query({ account: 'not-found-account', order_no: orderNo });

      expect(lookupRes.status).toBe(200);
      const matched = (lookupRes.body.orders || []).find((o) => o.order_no === orderNo);
      expect(matched).toBeTruthy();
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

  describe('PUT /api/orders/:id/status-steps', () => {
    it('should save manual step status text', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Step Status Buyer'
        });
      const order = createRes.body.order;

      const res = await request(app)
        .put(`/api/orders/${order.id}/status-steps`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status_steps: {
            step1: 'Order received',
            step2: 'Preparing paperwork',
            step3: 'Payment confirmed',
            step4: '',
            step5: '',
            step6: ''
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.order.status_steps.step1).toBe('Order received');
      expect(res.body.order.status_steps.step3).toBe('Payment confirmed');
      expect(res.body.order.status_steps.active_step).toBe('step3');
      expect(res.body.order.status).toBe('paid');
    });

    it('should allow toggling unpaid order to paid and then save steps', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 136000,
          buyer_name: 'Toggle Payment Buyer',
          payment_confirmed: false
        });
      const order = createRes.body.order;

      const res = await request(app)
        .put(`/api/orders/${order.id}/status-steps`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          payment_confirmed: true,
          status_steps: {
            step1: 'Deposit received',
            step2: 'Paperwork started',
            step3: '',
            step4: '',
            step5: '',
            step6: ''
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.order.payment_confirmed).toBe(true);
      expect(res.body.order.status_steps.active_step).toBe('step2');
      expect(res.body.order.can_edit_status_steps).toBe(true);
    });

    it('should reject step text longer than 200 chars', async () => {
      const testCar = await createAvailableCar();
      const createRes = await request(app)
        .post('/api/orders/admin')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          car_id: testCar.id,
          order_type: 'purchase',
          amount: 130000,
          buyer_name: 'Long Step Buyer'
        });
      const order = createRes.body.order;
      const longText = 'x'.repeat(201);

      const res = await request(app)
        .put(`/api/orders/${order.id}/status-steps`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status_steps: {
            step1: longText
          }
        });

      expect(res.status).toBe(400);
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
