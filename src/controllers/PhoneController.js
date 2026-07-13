const PhoneService = require('../services/PhoneService');
const SessionManager = require('../services/SessionManager');
const logger = require('../config/logger');

async function createPhone(req, res) {
  try {
    const { phoneNumber, displayName } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'phoneNumber e obrigatorio.' });
    }

    const phone = PhoneService.createPhone(phoneNumber, displayName);
    SessionManager.initSession(phone.id, phone.phoneNumber).catch((err) => {
      logger.error({ err, phoneId: phone.id }, 'Falha ao iniciar sessao');
    });

    logger.info({ phoneId: phone.id, phoneNumber: phone.phoneNumber }, 'Numero criado');
    return res.status(201).json({ success: true, data: phone });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

function getAllPhones(req, res) {
  const phones = PhoneService.getAllPhones().map((phone) => ({
    ...phone,
    isConnected: SessionManager.isConnected(phone.id),
  }));
  return res.status(200).json({ success: true, data: phones });
}

function getPhoneById(req, res) {
  const phone = PhoneService.getPhoneById(req.params.id);
  if (!phone) {
    return res.status(404).json({ success: false, error: 'Numero nao encontrado.' });
  }
  return res.status(200).json({
    success: true,
    data: { ...phone, isConnected: SessionManager.isConnected(phone.id) },
  });
}

function updatePhone(req, res) {
  const { displayName } = req.body;
  const updated = PhoneService.updatePhone(req.params.id, { displayName });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Numero nao encontrado.' });
  }
  return res.status(200).json({ success: true, data: updated });
}

async function deletePhone(req, res) {
  const phone = PhoneService.getPhoneById(req.params.id);
  if (!phone) {
    return res.status(404).json({ success: false, error: 'Numero nao encontrado.' });
  }

  await SessionManager.closeSession(req.params.id);
  PhoneService.deletePhone(req.params.id);

  logger.info({ phoneId: req.params.id }, 'Numero deletado');
  return res.status(200).json({ success: true, message: 'Numero removido com sucesso.' });
}

function getQRCode(req, res) {
  const phone = PhoneService.getPhoneById(req.params.id);
  if (!phone) {
    return res.status(404).json({ success: false, error: 'Numero nao encontrado.' });
  }

  if (SessionManager.isConnected(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Numero ja esta conectado.' });
  }

  const qrCode = SessionManager.getQRCode(req.params.id);
  if (!qrCode) {
    return res.status(503).json({
      success: false,
      error: 'QR code ainda nao disponivel. Tente novamente em alguns segundos.',
    });
  }

  return res.status(200).json({ success: true, data: { qrCode } });
}

function getPhoneStatus(req, res) {
  const phone = PhoneService.getPhoneById(req.params.id);
  if (!phone) {
    return res.status(404).json({ success: false, error: 'Numero nao encontrado.' });
  }

  return res.status(200).json({
    success: true,
    data: { id: phone.id, isConnected: SessionManager.isConnected(phone.id) },
  });
}

module.exports = {
  createPhone,
  getAllPhones,
  getPhoneById,
  updatePhone,
  deletePhone,
  getQRCode,
  getPhoneStatus,
};
