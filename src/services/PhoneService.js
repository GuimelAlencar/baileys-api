const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'phones.json');

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ phones: [] }, null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeDatabase(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sanitizePhoneNumber(phoneNumber) {
  return String(phoneNumber).replace(/\D/g, '');
}

function isValidPhoneNumber(phoneNumber) {
  const digits = sanitizePhoneNumber(phoneNumber);
  return digits.length >= 10 && digits.length <= 15;
}

function createPhone(phoneNumber, displayName) {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  if (!isValidPhoneNumber(sanitized)) {
    throw new Error('Numero de telefone invalido. Use formato E.164 (10-15 digitos).');
  }

  const db = readDatabase();
  const existing = db.phones.find((p) => p.phoneNumber === sanitized);
  if (existing) {
    throw new Error('Numero de telefone ja cadastrado.');
  }

  const now = new Date().toISOString();
  const phone = {
    id: uuidv4(),
    phoneNumber: sanitized,
    displayName: displayName || sanitized,
    isConnected: false,
    createdAt: now,
    updatedAt: now,
  };

  db.phones.push(phone);
  writeDatabase(db);
  return phone;
}

function getAllPhones() {
  return readDatabase().phones;
}

function getPhoneById(id) {
  return readDatabase().phones.find((p) => p.id === id) || null;
}

function updatePhone(id, updates) {
  const db = readDatabase();
  const index = db.phones.findIndex((p) => p.id === id);
  if (index === -1) {
    return null;
  }

  const allowedFields = ['displayName', 'isConnected'];
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      db.phones[index][key] = updates[key];
    }
  }
  db.phones[index].updatedAt = new Date().toISOString();

  writeDatabase(db);
  return db.phones[index];
}

function deletePhone(id) {
  const db = readDatabase();
  const index = db.phones.findIndex((p) => p.id === id);
  if (index === -1) {
    return false;
  }
  db.phones.splice(index, 1);
  writeDatabase(db);
  return true;
}

module.exports = {
  ensureDatabase,
  createPhone,
  getAllPhones,
  getPhoneById,
  updatePhone,
  deletePhone,
  isValidPhoneNumber,
  sanitizePhoneNumber,
};
