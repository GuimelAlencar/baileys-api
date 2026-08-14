require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrator';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           password_hash = EXCLUDED.password_hash,
           role = 'admin',
           is_active = true,
           updated_at = NOW()
     RETURNING id, email, role`,
    [email.toLowerCase(), displayName, passwordHash]
  );

  console.log(`Admin user upserted: ${rows[0].email} (id: ${rows[0].id})`);
  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
