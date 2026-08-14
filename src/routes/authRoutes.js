const express = require('express');
const AuthController = require('../controllers/AuthController');
const loginRateLimiter = require('../middleware/loginRateLimiter');

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     description: |
 *       Public endpoint. Returns an access token (short-lived JWT) and a refresh token
 *       (single-use, 7-day lifetime). Subject to per-IP rate limiting.
 *     security: []
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *           example:
 *             email: "admin@example.com"
 *             password: "Admin@1234"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TokenPair'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials or inactive account
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', loginRateLimiter, AuthController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh the access token
 *     description: |
 *       Public endpoint. Accepts a valid, unused refresh token and returns a new token pair.
 *       The presented refresh token is immediately invalidated (single-use rotation).
 *     security: []
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TokenPair'
 *       400:
 *         description: Missing refreshToken field
 *       401:
 *         description: Refresh token invalid, used, expired, or user inactive
 */
router.post('/refresh', AuthController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out (invalidate all refresh tokens)
 *     description: |
 *       Protected endpoint. Immediately invalidates all refresh tokens for the
 *       authenticated user across all devices.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Logged out from all devices"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', AuthController.logout);

module.exports = router;
