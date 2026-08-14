const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const bcrypt = require('bcrypt');

const TEST_ADMIN = {
  email: 'auth-test-admin@example.com',
  password: 'TestAdmin@1234',
  displayName: 'Auth Test Admin',
  role: 'admin',
};

let adminTokens;
let adminUserId;

beforeAll(async () => {
  const hash = await bcrypt.hash(TEST_ADMIN.password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = NOW()
     RETURNING id`,
    [TEST_ADMIN.email, TEST_ADMIN.displayName, hash, TEST_ADMIN.role]
  );
  adminUserId = rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [TEST_ADMIN.email]);
  await pool.end();
});

describe('POST /auth/login', () => {
  it('returns 200 with token pair on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data).toHaveProperty('expiresIn');
    expect(typeof res.body.data.expiresIn).toBe('number');
    adminTokens = res.body.data;
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 on inactive account', async () => {
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [adminUserId]);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Account is inactive');

    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [adminUserId]);
  });

  it('returns 400 on malformed email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'password' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/auth/login').send({ email: TEST_ADMIN.email });
    expect(res.status).toBe(400);
  });

  it('returns 429 after exceeding rate limit', async () => {
    // All requests from the same isolated IP to fill the bucket
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post('/auth/login')
          .set('X-Forwarded-For', '1.2.3.4')
          .send({ email: TEST_ADMIN.email, password: 'wrongpassword' })
      )
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(429);
  });
});

describe('POST /auth/refresh', () => {
  beforeAll(async () => {
    // Ensure we have fresh tokens
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    adminTokens = res.body.data;
  });

  it('returns 200 with new token pair on valid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: adminTokens.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.refreshToken).not.toBe(adminTokens.refreshToken);

    adminTokens = res.body.data;
  });

  it('returns 401 when the same refresh token is reused (single-use rotation)', async () => {
    const firstLogin = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const { refreshToken } = firstLogin.body.data;

    await request(app).post('/auth/refresh').send({ refreshToken });

    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.success).toBe(false);
  });

  it('returns 401 for invalid/garbage refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'completely-invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when refresh token belongs to deactivated user', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const { refreshToken } = loginRes.body.data;

    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [adminUserId]);

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);

    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [adminUserId]);
  });

  it('returns 400 when refreshToken field is missing', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  let sessionAToken;
  let sessionBRefresh;

  beforeEach(async () => {
    const a = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    sessionAToken = a.body.data.accessToken;

    const b = await request(app)
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    sessionBRefresh = b.body.data.refreshToken;
  });

  it('returns 200 on successful logout', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${sessionAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Logged out from all devices');
  });

  it('revokes all refresh tokens including other sessions', async () => {
    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${sessionAToken}`);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: sessionBRefresh });

    expect(res.status).toBe(401);
  });

  it('returns 401 without access token', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
