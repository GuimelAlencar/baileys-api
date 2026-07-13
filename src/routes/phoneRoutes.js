const express = require('express');
const PhoneController = require('../controllers/PhoneController');

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
 */
router.post('/', PhoneController.createPhone);

/**
 * @openapi
 * /api/phones:
 *   get:
 *     summary: Lista todos os numeros cadastrados
 *     tags: [Phones]
 *     responses:
 *       200: { description: Lista de numeros }
 */
router.get('/', PhoneController.getAllPhones);

/**
 * @openapi
 * /api/phones/{id}:
 *   get:
 *     summary: Obtem detalhes de um numero
 *     tags: [Phones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Numero encontrado }
 *       404: { description: Numero nao encontrado }
 */
router.get('/:id', PhoneController.getPhoneById);

/**
 * @openapi
 * /api/phones/{id}:
 *   put:
 *     summary: Atualiza o nome de exibicao de um numero
 *     tags: [Phones]
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
 *       404: { description: Numero nao encontrado }
 */
router.put('/:id', PhoneController.updatePhone);

/**
 * @openapi
 * /api/phones/{id}:
 *   delete:
 *     summary: Remove um numero e encerra a sessao
 *     tags: [Phones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Numero removido }
 *       404: { description: Numero nao encontrado }
 */
router.delete('/:id', PhoneController.deletePhone);

/**
 * @openapi
 * /api/phones/{id}/qrcode:
 *   get:
 *     summary: Retorna o QR code (base64) para autenticar o numero
 *     tags: [Phones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: QR code disponivel }
 *       404: { description: Numero nao encontrado }
 *       503: { description: QR code ainda nao gerado }
 */
router.get('/:id/qrcode', PhoneController.getQRCode);

/**
 * @openapi
 * /api/phones/{id}/status:
 *   get:
 *     summary: Verifica o status de conexao de um numero
 *     tags: [Phones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status atual }
 *       404: { description: Numero nao encontrado }
 */
router.get('/:id/status', PhoneController.getPhoneStatus);

module.exports = router;
