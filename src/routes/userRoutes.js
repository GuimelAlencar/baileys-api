const express = require('express');
const UserController = require('../controllers/UserController');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         displayName: { type: string }
 *         role:
 *           type: string
 *           enum: [admin, operator]
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, email, displayName, role, isActive, createdAt, updatedAt]
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken: { type: string }
 *         refreshToken: { type: string }
 *         expiresIn: { type: integer }
 *       required: [accessToken, refreshToken, expiresIn]
 *     PaginatedUsers:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         data:
 *           type: object
 *           properties:
 *             users:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *             total: { type: integer }
 *             page: { type: integer }
 *             limit: { type: integer }
 *   responses:
 *     Unauthorized:
 *       description: Missing, expired, or invalid access token.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success: { type: boolean, example: false }
 *               error: { type: string }
 */

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user (admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, displayName, password, role]
 *             properties:
 *               email: { type: string, format: email }
 *               displayName: { type: string, minLength: 1, maxLength: 100 }
 *               password: { type: string, minLength: 8 }
 *               role:
 *                 type: string
 *                 enum: [admin, operator]
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400: { description: Validation error }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Insufficient permissions }
 *       409: { description: Email already registered }
 */
router.post('/', authorize(['admin']), UserController.createUser);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedUsers'
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Insufficient permissions }
 */
router.get('/', authorize(['admin']), UserController.listUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Insufficient permissions }
 *       404: { description: User not found }
 */
router.get('/:id', authorize(['admin']), UserController.getUserById);

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Update a user's display name or role (admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string, minLength: 1, maxLength: 100 }
 *               role:
 *                 type: string
 *                 enum: [admin, operator]
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400: { description: Validation error or self-edit attempt }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Insufficient permissions }
 *       404: { description: User not found }
 */
router.put('/:id', authorize(['admin']), UserController.updateUser);

/**
 * @openapi
 * /users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a user (admin only)
 *     description: |
 *       Sets the user's isActive to false and immediately revokes all their refresh tokens.
 *       Self-deactivation is rejected.
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400: { description: Self-deactivation attempt }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Insufficient permissions }
 *       404: { description: User not found }
 */
router.patch('/:id/deactivate', authorize(['admin']), UserController.deactivateUser);

module.exports = router;
