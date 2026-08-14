const express = require('express');
const multer = require('multer');
const MessageController = require('../controllers/MessageController');
const authorize = require('../middleware/authorize');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB, limite do WhatsApp
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Arquivo deve ser um PDF (application/pdf).'));
    }
    cb(null, true);
  },
});

function uploadPdf(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}

/**
 * @openapi
 * /api/messages/send:
 *   post:
 *     summary: Envia uma mensagem de texto
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneId, recipientPhone, message]
 *             properties:
 *               phoneId: { type: string, format: uuid }
 *               recipientPhone: { type: string, example: "5511888888888" }
 *               message: { type: string, example: "Ola! Seu boleto esta pronto." }
 *     responses:
 *       200: { description: Mensagem enviada }
 *       400: { description: Dados invalidos ou numero desconectado }
 *       401: { description: Token ausente ou expirado }
 */
router.post('/send', authorize(['admin', 'operator']), MessageController.sendSimpleMessage);

/**
 * @openapi
 * /api/messages/send-pdf:
 *   post:
 *     summary: Envia um documento PDF (upload direto via multipart/form-data)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [phoneId, recipientPhone, file]
 *             properties:
 *               phoneId: { type: string, format: uuid }
 *               recipientPhone: { type: string, example: "5511888888888" }
 *               caption: { type: string, example: "Boleto para pagamento" }
 *               file: { type: string, format: binary, description: "Arquivo PDF (max 100MB)" }
 *     responses:
 *       200: { description: PDF enviado }
 *       400: { description: Dados invalidos, arquivo ausente/invalido ou numero desconectado }
 *       401: { description: Token ausente ou expirado }
 */
router.post('/send-pdf', authorize(['admin', 'operator']), uploadPdf, MessageController.sendPdfMessage);

module.exports = router;
