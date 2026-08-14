const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});

module.exports = loginRateLimiter;
