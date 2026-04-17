const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, accountType } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const role = accountType === 'host' ? 'host' : 'user';
  const user = await User.create({ name, email, password: hashedPassword, role });

  return res.status(201).json({
    token: generateToken(user._id),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
};

const updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const nextName = String(name || '').trim();
  const nextEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!nextName || !nextEmail) {
    return res.status(400).json({ message: 'name and email are required' });
  }

  const duplicate = await User.findOne({ email: nextEmail, _id: { $ne: req.user._id } });
  if (duplicate) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { name: nextName, email: nextEmail },
    { new: true, runValidators: true }
  ).select('-password');

  return res.status(200).json(updated);
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  return res.status(200).json({ message: 'Password updated' });
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.status(200).json({
    token: generateToken(user._id),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
};

const profile = async (req, res) => {
  res.json(req.user);
};

module.exports = { register, login, profile, updateProfile, changePassword };
