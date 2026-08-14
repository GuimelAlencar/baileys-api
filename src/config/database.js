const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle pg client');
});

module.exports = pool;
