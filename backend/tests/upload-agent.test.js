const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, sellerToken, testAgent } = {
  app: global._testApp,
  sellerToken: global._sellerToken,
  testAgent: global._testAgent,
};

describe('Upload API', () => {
  const uploadsDir = path.join(__dirname, '../public/uploads');

  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  describe('POST /api/upload', () => {
    it('should reject request without files', async () => {
      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(400);
    });

    it('should accept image file', async () => {
      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${sellerToken}`)
        .attach('images', path.join(__dirname, 'test-image.png'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.urls)).toBe(true);
      expect(res.body.urls.length).toBeGreaterThan(0);
      expect(res.body.urls[0]).toMatch(/^\/uploads\/.+/);
    });

    it('should accept multiple image files', async () => {
      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${sellerToken}`)
        .attach('images', path.join(__dirname, 'test-image.png'))
        .attach('images', path.join(__dirname, 'test-image.png'));
      expect(res.status).toBe(200);
      expect(res.body.urls.length).toBe(2);
    });
  });
});

describe('Agent API', () => {
  describe('GET /api/agent', () => {
    it('should list agents', async () => {
      const res = await request(app).get('/api/agent');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it('should filter by active status', async () => {
      const res = await request(app).get('/api/agent?is_active=true');
      expect(res.status).toBe(200);
      res.body.agents.forEach(a => expect(a.is_active).toBe(true));
    });
  });

  describe('POST /api/agent', () => {
    it('should create agent as seller', async () => {
      const res = await request(app)
        .post('/api/agent')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ code: 'AGT002', name: 'Jane Agent', email: 'jane@test.com', phone: '+60 13-456 7890' });
      expect(res.status).toBe(201);
      expect(res.body.agent).toHaveProperty('code', 'AGT002');
    });

    it('should reject duplicate agent code', async () => {
      const res = await request(app)
        .post('/api/agent')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ code: 'AGT002', name: 'Duplicate Agent' });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/agent/:id', () => {
    it('should update agent', async () => {
      const res = await request(app)
        .put(`/api/agent/${testAgent.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ name: 'Updated Agent Name', phone: '+60 14-999 8888' });
      expect(res.status).toBe(200);
      expect(res.body.agent).toHaveProperty('name', 'Updated Agent Name');
    });
  });

  describe('DELETE /api/agent/:id', () => {
    it('should delete agent', async () => {
      const res = await request(app)
        .delete(`/api/agent/${testAgent.id}`)
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
    });
  });
});
