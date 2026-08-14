const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const bcrypt = require('bcrypt');

const ADMIN = {
  email: 'users-test-admin@example.com',
  password: 'UsersAdmin@1234',
  displayName: 'Users Test Admin',
  role: 'admin',
};

const OPERATOR = {
  email: 'users-test-operator@example.com',
  password: 'UsersOp@1234',
  displayName: 'Users Test Operator',
  role: 'operator',
};

let adminToken;
let operatorToken;
let adminUserId;
let createdUserId;

beforeAll(async () => {
  const hash = await bcrypt.hash(ADMIN.password, 12);
  const { rows: adminRows } = await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = NOW()
     RETURNING id`,
    [ADMIN.email, ADMIN.displayName, hash, ADMIN.role]
  );
  adminUserId = adminRows[0].id;

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
  await pool.query('DELETE FROM users WHERE email LIKE \'users-test-%\' OR email = \'newuser@example.com\' OR email = \'dupe@example.com\'');
  await pool.end();
});

// ─── US3: Admin Creates New User ─────────────────────────────────────────────

describe('POST /users (US3 - Create User)', () => {
  it('admin creates a new operator user (201)', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newuser@example.com',
        displayName: 'New Operator',
        password: 'Newuser@1234',
        role: 'operator',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe('newuser@example.com');
    expect(res.body.data.role).toBe('operator');
    expect(res.body.data).not.toHaveProperty('password_hash');
    expect(res.body.data).not.toHaveProperty('passwordHash');
    createdUserId = res.body.data.id;
  });

  it('operator cannot create a user (403)', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        email: 'another@example.com',
        displayName: 'Another',
        password: 'Another@1234',
        role: 'operator',
      });
    expect(res.status).toBe(403);
  });

  it('returns 409 on duplicate email', async () => {
    await pool.query(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ('dupe@example.com', 'Dupe', 'hash', 'operator')
       ON CONFLICT DO NOTHING`
    );
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'dupe@example.com',
        displayName: 'Dupe Again',
        password: 'Dupe@1234',
        role: 'operator',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it('returns 400 when password is shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'short@example.com',
        displayName: 'Short Pass',
        password: 'abc',
        role: 'operator',
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'missing@example.com', role: 'operator' });
    expect(res.status).toBe(400);
  });

  it('created user can log in immediately', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'newuser@example.com', password: 'Newuser@1234' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('concurrent duplicate email results in exactly one 201 and one 409', async () => {
    const payload = {
      email: 'concurrent@example.com',
      displayName: 'Concurrent',
      password: 'Concurrent@1234',
      role: 'operator',
    };
    const [r1, r2] = await Promise.all([
      request(app).post('/users').set('Authorization', `Bearer ${adminToken}`).send(payload),
      request(app).post('/users').set('Authorization', `Bearer ${adminToken}`).send(payload),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    await pool.query("DELETE FROM users WHERE email = 'concurrent@example.com'");
  });
});

// ─── US4: Admin Manages Existing Users ───────────────────────────────────────

describe('GET /users (US4 - List Users)', () => {
  it('admin can list users with pagination (200)', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('limit');
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('returns page 1 with limit 1', async () => {
    const res = await request(app)
      .get('/users?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(1);
  });

  it('clamps limit to max 100', async () => {
    const res = await request(app)
      .get('/users?limit=200')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(100);
  });
});

describe('GET /users/:id (US4 - Get User)', () => {
  it('admin can get a user by id (200)', async () => {
    const res = await request(app)
      .get(`/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(adminUserId);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /users/:id (US4 - Update User)', () => {
  it('admin can update user role (200) and change is immediate', async () => {
    // Get operator user id
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [OPERATOR.email]);
    const opId = rows[0].id;

    // Update role to admin
    const res = await request(app)
      .put(`/users/${opId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');

    // Verify next request uses new role (operator token now has admin DB role)
    const listRes = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(listRes.status).toBe(200);

    // Restore
    await request(app)
      .put(`/users/${opId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operator' });
  });

  it('admin can update display name (200)', async () => {
    const res = await request(app)
      .put(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'Updated Admin Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Updated Admin Name');
  });

  it('returns 400 when admin tries to update own account', async () => {
    const res = await request(app)
      .put(`/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'Self Edit' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/:id/deactivate (US4 - Deactivate User)', () => {
  let tempUserId;

  beforeAll(async () => {
    const hash = await bcrypt.hash('Temp@1234', 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ('temp-deactivate@example.com', 'Temp User', $1, 'operator')
       ON CONFLICT (email) DO UPDATE SET is_active = true, updated_at = NOW()
       RETURNING id`,
      [hash]
    );
    tempUserId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'temp-deactivate@example.com'");
  });

  it('admin deactivates a user (200, isActive=false)', async () => {
    const res = await request(app)
      .patch(`/users/${tempUserId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('deactivated user login is rejected (401)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'temp-deactivate@example.com', password: 'Temp@1234' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Account is inactive');
  });

  it('deactivated user refresh token is rejected (401)', async () => {
    // Re-activate temporarily to get a refresh token, then deactivate again
    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [tempUserId]);
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'temp-deactivate@example.com', password: 'Temp@1234' });
    const { refreshToken } = loginRes.body.data;
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [tempUserId]);

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('admin cannot deactivate own account (400)', async () => {
    const res = await request(app)
      .patch(`/users/${adminUserId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot deactivate your own account');
  });
});
