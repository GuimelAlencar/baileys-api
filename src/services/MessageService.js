const PhoneService = require('./PhoneService');
const SessionManager = require('./SessionManager');

function validatePhoneNumber(phoneNumber) {
  if (!PhoneService.isValidPhoneNumber(phoneNumber)) {
    throw new Error('Numero destinatario invalido. Use formato E.164 (10-15 digitos).');
  }
}

function assertPhoneConnected(phoneId) {
  const phone = PhoneService.getPhoneById(phoneId);
  if (!phone) {
    throw new Error('Numero remetente nao encontrado.');
  }
  if (!SessionManager.isConnected(phoneId)) {
    throw new Error('Numero remetente nao esta conectado.');
  }
  return phone;
}

async function sendSimpleMessage(phoneId, recipientPhone, message) {
  if (!message || message.length === 0 || message.length > 4096) {
    throw new Error('Mensagem deve ter entre 1 e 4096 caracteres.');
  }
  validatePhoneNumber(recipientPhone);
  const phone = assertPhoneConnected(phoneId);

  const messageId = await SessionManager.sendTextMessage(phoneId, recipientPhone, message);

  return {
    from: phone.phoneNumber,
    to: PhoneService.sanitizePhoneNumber(recipientPhone),
    type: 'text',
    messageId,
    timestamp: new Date().toISOString(),
  };
}

async function sendPdfMessage(phoneId, recipientPhone, fileBuffer, originalFileName, caption) {
  if (caption && caption.length > 1024) {
    throw new Error('Legenda deve ter no maximo 1024 caracteres.');
  }
  validatePhoneNumber(recipientPhone);
  const phone = assertPhoneConnected(phoneId);

  const { messageId, fileName } = await SessionManager.sendPdfMessage(
    phoneId,
    recipientPhone,
    fileBuffer,
    originalFileName,
    caption
  );

  return {
    from: phone.phoneNumber,
    to: PhoneService.sanitizePhoneNumber(recipientPhone),
    type: 'document',
    fileName,
    caption: caption || undefined,
    messageId,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  validatePhoneNumber,
  sendSimpleMessage,
  sendPdfMessage,
};
