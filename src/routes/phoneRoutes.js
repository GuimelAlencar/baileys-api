const express = require('express');
const PhoneController = require('../controllers/PhoneController');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Phone:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         phoneNumber: { type: string, example: "5511999999999" }
 *         displayName: { type: string, example: "WhatsApp Principal" }
 *         isConnected: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/phones:
 *   post:
 *     summary: Cria um novo numero e inicia a sessao Baileys
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber: { type: string, example: "5511999999999" }
 *               displayName: { type: string, example: "WhatsApp Principal" }
 *     responses:
 *       201: { description: Numero criado }
 *       400: { description: Dados invalidos }
 *       401: { description: Token ausente ou expirado }
 *       403: { description: Permissao insuficiente }
 */
router.post('/', authorize(['admin']), PhoneController.createPhone);

/**
 * @openapi
 * /api/phones:
 *   get:
 *     summary: Lista todos os numeros cadastrados
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de numeros }
 *       401: { description: Token ausente ou expirado }
 */
router.get('/', authorize(['admin', 'operator']), PhoneController.getAllPhones);

/**
 * @openapi
 * /api/phones/{id}:
 *   get:
 *     summary: Obtem detalhes de um numero
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Numero encontrado }
 *       401: { description: Token ausente ou expirado }
 *       404: { description: Numero nao encontrado }
 */
router.get('/:id', authorize(['admin', 'operator']), PhoneController.getPhoneById);

/**
 * @openapi
 * /api/phones/{id}:
 *   put:
 *     summary: Atualiza o nome de exibicao de um numero
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string }
 *     responses:
 *       200: { description: Numero atualizado }
 *       401: { description: Token ausente ou expirado }
 *       403: { description: Permissao insuficiente }
 *       404: { description: Numero nao encontrado }
 */
router.put('/:id', authorize(['admin']), PhoneController.updatePhone);

/**
 * @openapi
 * /api/phones/{id}:
 *   delete:
 *     summary: Remove um numero e encerra a sessao
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Numero removido }
 *       401: { description: Token ausente ou expirado }
 *       403: { description: Permissao insuficiente }
 *       404: { description: Numero nao encontrado }
 */
router.delete('/:id', authorize(['admin']), PhoneController.deletePhone);

/**
 * @openapi
 * /api/phones/{id}/qrcode:
 *   get:
 *     summary: Retorna o QR code (base64) para autenticar o numero
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: QR code disponivel }
 *       401: { description: Token ausente ou expirado }
 *       404: { description: Numero nao encontrado }
 *       503: { description: QR code ainda nao gerado }
 */
router.get('/:id/qrcode', authorize(['admin', 'operator']), PhoneController.getQRCode);

/**
 * @openapi
 * /api/phones/{id}/status:
 *   get:
 *     summary: Verifica o status de conexao de um numero
 *     tags: [Phones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status atual }
 *       401: { description: Token ausente ou expirado }
 *       404: { description: Numero nao encontrado }
 */
router.get('/:id/status', authorize(['admin', 'operator']), PhoneController.getPhoneStatus);

module.exports = router;
