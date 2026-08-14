const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const ADMIN = {
  email: 'perm-test-admin@example.com',
  password: 'PermAdmin@1234',
  displayName: 'Perm Admin',
  role: 'admin',
};

const OPERATOR = {
  email: 'perm-test-operator@example.com',
  password: 'PermOp@1234',
  displayName: 'Perm Operator',
  role: 'operator',
};

let adminToken;
let operatorToken;

beforeAll(async () => {
  const hash = await bcrypt.hash(ADMIN.password, 12);
  await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = NOW()`,
    [ADMIN.email, ADMIN.displayName, hash, ADMIN.role]
  );

  const opHash = await bcrypt.hash(OPERATOR.password, 12);
  await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = NOW()`,
    [OPERATOR.email, OPERATOR.displayName, opHash, OPERATOR.role]
  );

  const adminRes = await request(app)
    .post('/auth/login')
    .send({ email: ADMIN.email, password: ADMIN.password });
  adminToken = adminRes.body.data.accessToken;

  const opRes = await request(app)
    .post('/auth/login')
    .send({ email: OPERATOR.email, password: OPERATOR.password });
  operatorToken = opRes.body.data.accessToken;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [ADMIN.email, OPERATOR.email]);
  await pool.end();
});

describe('Unauthenticated requests', () => {
  it('GET /api/phones returns 401 without token', async () => {
    const res = await request(app).get('/api/phones');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/messages/send returns 401 without token', async () => {
    const res = await request(app).post('/api/messages/send').send({});
    expect(res.status).toBe(401);
  });

  it('GET /users returns 401 without token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });
});

describe('Expired / invalid token', () => {
  it('returns 401 with an expired JWT', async () => {
    const expired = jwt.sign(
      { sub: 'fake-user-id' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: -1 }
    );
    const res = await request(app)
      .get('/api/phones')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/phones')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
  });
});

describe('Public endpoints remain accessible', () => {
  it('GET /health is public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /api-docs.json is public', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
  });
});

describe('Operator permissions', () => {
  it('operator can GET /api/phones (200)', async () => {
    const res = await request(app)
      .get('/api/phones')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
  });

  it('operator cannot POST /api/phones (403)', async () => {
    const res = await request(app)
      .post('/api/phones')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ phoneNumber: '5511999999999' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('operator cannot GET /users (403)', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('operator can POST /api/messages/send (200 or 503, not 403)', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ phoneId: 'fake', recipientPhone: '5511000000000', message: 'test' });
    expect([200, 400, 404, 503]).toContain(res.status);
    expect(res.status).not.toBe(403);
  });
});

describe('Admin permissions', () => {
  it('admin can GET /users (200)', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('admin can GET /api/phones (200)', async () => {
    const res = await request(app)
      .get('/api/phones')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
