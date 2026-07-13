const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const logger = require('../config/logger');
const PhoneService = require('./PhoneService');

const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), 'auth_info');
const MAX_RECONNECT_ATTEMPTS = Number(process.env.MAX_RECONNECT_ATTEMPTS || 5);
const RECONNECT_BASE_DELAY_MS = Number(process.env.RECONNECT_BASE_DELAY_MS || 3000);

// sessions: Map<phoneId, { sock, isConnected, reconnectAttempts }>
const sessions = new Map();
// qrCodes: Map<phoneId, string base64>
const qrCodes = new Map();

function getSessionDir(phoneId) {
  return path.join(AUTH_DIR, `session_${phoneId}`);
}

let cachedWAVersion = null;

async function getWAVersion() {
  if (!cachedWAVersion) {
    try {
      const { version } = await fetchLatestBaileysVersion();
      cachedWAVersion = version;
    } catch (err) {
      logger.warn({ err }, 'Falha ao buscar versao mais recente do WhatsApp Web; usando versao padrao do Baileys');
    }
  }
  return cachedWAVersion || undefined;
}

async function initSession(phoneId, phoneNumber) {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const sessionDir = getSessionDir(phoneId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const version = await getWAVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ module: 'baileys', phoneId }),
    printQRInTerminal: false,
  });

  const entry = sessions.get(phoneId) || { reconnectAttempts: 0 };
  entry.sock = sock;
  entry.isConnected = false;
  sessions.set(phoneId, entry);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrImage = await QRCode.toDataURL(qr);
        qrCodes.set(phoneId, qrImage);
      } catch (err) {
        logger.error({ err, phoneId }, 'Falha ao gerar QR code');
      }
    }

    if (connection === 'open') {
      entry.isConnected = true;
      entry.reconnectAttempts = 0;
      qrCodes.delete(phoneId);
      PhoneService.updatePhone(phoneId, { isConnected: true });
      logger.info({ phoneId, phoneNumber }, 'Sessao conectada');
    }

    if (connection === 'close') {
      entry.isConnected = false;
      PhoneService.updatePhone(phoneId, { isConnected: false });

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut =
        statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden;

      if (isLoggedOut) {
        logger.warn({ phoneId }, 'Sessao encerrada permanentemente (logout/ban). Requer novo QR code.');
        sessions.delete(phoneId);
        qrCodes.delete(phoneId);
        return;
      }

      if (entry.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error({ phoneId }, 'Numero maximo de tentativas de reconexao atingido');
        sessions.delete(phoneId);
        qrCodes.delete(phoneId);
        return;
      }

      entry.reconnectAttempts += 1;
      const delay = RECONNECT_BASE_DELAY_MS * entry.reconnectAttempts;
      logger.warn(
        { phoneId, attempt: entry.reconnectAttempts, delay },
        'Tentando reconectar...'
      );
      setTimeout(() => initSession(phoneId, phoneNumber), delay);
    }
  });

  return sock;
}

function getSession(phoneId) {
  return sessions.get(phoneId)?.sock || null;
}

function isConnected(phoneId) {
  return Boolean(sessions.get(phoneId)?.isConnected);
}

function getQRCode(phoneId) {
  return qrCodes.get(phoneId) || null;
}

async function closeSession(phoneId) {
  const entry = sessions.get(phoneId);
  if (entry?.sock) {
    try {
      await entry.sock.logout();
    } catch (err) {
      logger.warn({ err, phoneId }, 'Erro ao encerrar sessao (ignorado)');
    }
  }
  sessions.delete(phoneId);
  qrCodes.delete(phoneId);

  const sessionDir = getSessionDir(phoneId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

function formatJid(phoneNumber) {
  const digits = PhoneService.sanitizePhoneNumber(phoneNumber);
  return `${digits}@s.whatsapp.net`;
}

async function sendTextMessage(phoneId, recipientPhone, message) {
  const sock = getSession(phoneId);
  if (!sock || !isConnected(phoneId)) {
    throw new Error('Sessao nao esta conectada.');
  }

  const jid = formatJid(recipientPhone);
  const result = await sock.sendMessage(jid, { text: message });
  return result?.key?.id || null;
}

async function sendPdfMessage(phoneId, recipientPhone, buffer, fileName, caption) {
  const sock = getSession(phoneId);
  if (!sock || !isConnected(phoneId)) {
    throw new Error('Sessao nao esta conectada.');
  }

  const jid = formatJid(recipientPhone);
  const result = await sock.sendMessage(jid, {
    document: buffer,
    mimetype: 'application/pdf',
    fileName,
    caption: caption || undefined,
  });

  return { messageId: result?.key?.id || null, fileName };
}

function getAllSessions() {
  return Array.from(sessions.entries()).map(([phoneId, entry]) => ({
    phoneId,
    isConnected: Boolean(entry.isConnected),
    reconnectAttempts: entry.reconnectAttempts || 0,
  }));
}

module.exports = {
  initSession,
  getSession,
  isConnected,
  getQRCode,
  closeSession,
  sendTextMessage,
  sendPdfMessage,
  getAllSessions,
};
