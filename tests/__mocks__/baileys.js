const makeWASocket = jest.fn(() => ({
  ev: { on: jest.fn() },
  logout: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue({ key: { id: 'mock-msg-id' } }),
}));

module.exports = {
  default: makeWASocket,
  makeWASocket,
  useMultiFileAuthState: jest.fn().mockResolvedValue({
    state: {},
    saveCreds: jest.fn(),
  }),
  DisconnectReason: {
    loggedOut: 401,
    forbidden: 403,
  },
  fetchLatestBaileysVersion: jest.fn().mockResolvedValue({
    version: [2, 3000, 1023513796],
  }),
};
