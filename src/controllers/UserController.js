const UserService = require('../services/UserService');

async function createUser(req, res, next) {
  try {
    const { email, displayName, password, role } = req.body;
    const user = await UserService.create({ email, displayName, password, role }, req.userId);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await UserService.findAll(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await UserService.findById(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { displayName, role } = req.body;
    const user = await UserService.update(req.params.id, { displayName, role }, req.userId);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const user = await UserService.deactivate(req.params.id, req.userId);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

module.exports = { createUser, listUsers, getUserById, updateUser, deactivateUser };
