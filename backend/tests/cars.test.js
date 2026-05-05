const request = require('supertest');
const { app, sellerToken, buyerToken, testCar } = {
  app: global._testApp,
  sellerToken: global._sellerToken,
  buyerToken: global._buyerToken,
  testCar: global._testCar,
};

describe('Cars API', () => {
  describe('GET /api/cars', () => {
    it('should list cars', async () => {
      const res = await request(app).get('/api/cars');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cars');
      expect(Array.isArray(res.body.cars)).toBe(true);
    });

    it('should filter by brand', async () => {
      const res = await request(app).get('/api/cars?brand=Toyota');
      expect(res.status).toBe(200);
      res.body.cars.forEach(car => {
        expect(car.brand).toMatch(/toyota/i);
      });
    });

    it('should filter by status=available', async () => {
      const res = await request(app).get('/api/cars?status=available');
      expect(res.status).toBe(200);
      res.body.cars.forEach(car => {
        expect(['available', 'sold']).toContain(car.status);
      });
    });

    it('should include auction cars with includeAuction=1', async () => {
      await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          brand: 'BMW',
          model: 'M3',
          year: 2022,
          mileage: 10000,
          price: 350000,
          status: 'auction',
          auction_end_time: new Date(Date.now() + 86400000),
          starting_bid: 300000
        });

      const res = await request(app).get('/api/cars?includeAuction=1');
      expect(res.status).toBe(200);
      const hasAuction = res.body.cars.some(c => c.status === 'auction');
      expect(hasAuction).toBe(true);
    });
  });

  describe('POST /api/cars', () => {
    it('should create a car as seller', async () => {
      const res = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          brand: 'Honda',
          model: 'Civic',
          year: 2022,
          mileage: 20000,
          price: 125000,
          status: 'available',
          repaired: 'no'
        });
      expect(res.status).toBe(201);
      expect(res.body.car).toHaveProperty('brand', 'Honda');
      expect(res.body.car).toHaveProperty('repaired', 'no');
    });

    it('should reject create without auth', async () => {
      const res = await request(app)
        .post('/api/cars')
        .send({ brand: 'Honda', model: 'Civic', year: 2022, mileage: 20000, price: 125000 });
      expect(res.status).toBe(401);
    });

    it('should reject create as buyer', async () => {
      const res = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ brand: 'Honda', model: 'Civic', year: 2022, mileage: 20000, price: 125000 });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/cars/:id', () => {
    it('should return single car', async () => {
      const res = await request(app).get(`/api/cars/${testCar.id}`);
      expect(res.status).toBe(200);
      expect(res.body.car).toHaveProperty('id', testCar.id);
    });

    it('should return 404 for non-existent car', async () => {
      const res = await request(app).get('/api/cars/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/cars/:id', () => {
    it('should update car as seller', async () => {
      const res = await request(app)
        .put(`/api/cars/${testCar.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: 140000, repaired: 'yes' });
      expect(res.status).toBe(200);
      expect(res.body.car).toHaveProperty('price', 140000);
      expect(res.body.car).toHaveProperty('repaired', 'yes');
    });
  });

  describe('DELETE /api/cars/:id', () => {
    it('should soft-delete car', async () => {
      const create = await request(app)
        .post('/api/cars')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ brand: 'Mazda', model: 'CX-5', year: 2023, mileage: 5000, price: 155000 });
      const carToDelete = create.body.car;

      const res = await request(app)
        .delete(`/api/cars/${carToDelete.id}`)
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/cars/${carToDelete.id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
