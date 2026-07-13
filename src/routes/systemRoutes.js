const express = require('express');
const PhoneService = require('../services/PhoneService');
const SessionManager = require('../services/SessionManager');

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Verifica se a API esta no ar
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Servico saudavel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptime: { type: number, example: 3661.234, description: "Segundos desde o ultimo start" }
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: Status geral de todos os numeros cadastrados
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Resumo de conexao de todos os numeros
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPhones: { type: integer, example: 2 }
 *                 connectedPhones: { type: integer, example: 1 }
 *                 phones:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Phone'
 */
router.get('/api/status', (req, res) => {
  const phones = PhoneService.getAllPhones().map((phone) => ({
    ...phone,
    isConnected: SessionManager.isConnected(phone.id),
  }));

  res.status(200).json({
    totalPhones: phones.length,
    connectedPhones: phones.filter((p) => p.isConnected).length,
    phones,
  });
});

module.exports = router;
