const request = require('supertest');
const fixtures = require('./fixtures');
let app;

beforeAll(() => {
  app = fixtures.app;
});

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'newuser@test.com',
          password: 'Test@123456',
          phone: '+60 12-111 2222'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('verification_required', true);
      expect(res.body).toHaveProperty('email', 'newuser@test.com');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'newuser@test.com',
          password: 'Test@123456',
          phone: '+60 12-111 2222'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exist|already|duplicate/i);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Weak User',
          email: 'weak@test.com',
          password: '123',
          phone: '+60 12-111 2222'
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'seller@test.com', password: 'Seller@123456' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'seller@test.com', password: 'WrongPassword' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'Test@123456' });
      expect(res.status).toBe(401);
    });

    it('should require email verification for unverified buyer', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Unverified User',
          email: 'verifyme@test.com',
          password: 'Test@123456',
          phone: '+60 12-999 8888'
        });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'verifyme@test.com', password: 'Test@123456' });
      expect(res.status).toBe(403);
      expect(res.body.verification_required).toBe(true);
    });
  });

  describe('POST /api/auth/verify-email-code', () => {
    it('should verify email code and return login token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Verify User',
          email: 'verify-code@test.com',
          password: 'Test@123456',
          phone: '+60 12-121 2121'
        });
      expect(registerRes.status).toBe(201);

      const { User } = require('../src/models');
      const created = await User.findOne({ where: { email: 'verify-code@test.com' } });
      expect(created).toBeTruthy();
      expect(created.email_verification_code).toBeTruthy();

      const verifyRes = await request(app)
        .post('/api/auth/verify-email-code')
        .send({
          email: 'verify-code@test.com',
          code: created.email_verification_code
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('token');
      expect(verifyRes.body.user.email_verified).toBe(true);
    });
  });

  describe('POST /api/auth/forgot-password + /reset-password', () => {
    it('should issue reset token and accept password reset', async () => {
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'buyer@test.com' });
      expect(forgotRes.status).toBe(200);

      const { User } = require('../src/models');
      const buyer = await User.findOne({ where: { email: 'buyer@test.com' } });
      expect(buyer.reset_token).toBeTruthy();

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: buyer.reset_token,
          newPassword: 'Buyer@654321'
        });
      expect(resetRes.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'buyer@test.com', password: 'Buyer@654321' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('token');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const token = fixtures.sellerToken;
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', 'seller@test.com');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
