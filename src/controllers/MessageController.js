const MessageService = require('../services/MessageService');
const logger = require('../config/logger');

async function sendSimpleMessage(req, res) {
  try {
    const { phoneId, recipientPhone, message } = req.body;
    if (!phoneId || !recipientPhone || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneId, recipientPhone e message sao obrigatorios.',
      });
    }

    const data = await MessageService.sendSimpleMessage(phoneId, recipientPhone, message);
    logger.info({ from: data.from, to: data.to }, 'Mensagem de texto enviada');
    return res.status(200).json({ success: true, data, message: 'Mensagem enviada com sucesso' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

async function sendPdfMessage(req, res) {
  try {
    const { phoneId, recipientPhone, caption } = req.body;
    if (!phoneId || !recipientPhone || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'phoneId, recipientPhone e o arquivo PDF (campo "file") sao obrigatorios.',
      });
    }

    const data = await MessageService.sendPdfMessage(
      phoneId,
      recipientPhone,
      req.file.buffer,
      req.file.originalname,
      caption
    );
    logger.info({ from: data.from, to: data.to }, 'PDF enviado');
    return res.status(200).json({ success: true, data, message: 'PDF enviado com sucesso' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  sendSimpleMessage,
  sendPdfMessage,
};
