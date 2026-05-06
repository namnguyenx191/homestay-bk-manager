/** Lightweight request body checks (avoids loading express-validator at startup). */

const err = (msg, path) => ({ type: 'field', msg, path, location: 'body' });

const isEmail = (raw) => {
  const s = String(raw || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

const validateRegister = (req, res, next) => {
  const { name, email, password, accountType } = req.body || {};
  const errors = [];
  if (!String(name || '').trim()) errors.push(err('Name is required', 'name'));
  if (!isEmail(email)) errors.push(err('Email is invalid', 'email'));
  const pw = String(password || '');
  if (!pw || pw.length < 6) errors.push(err('Password must be at least 6 characters', 'password'));
  if (accountType != null && accountType !== '' && !['user', 'host'].includes(accountType)) {
    errors.push(err('Invalid account type', 'accountType'));
  }
  if (errors.length) return res.status(400).json({ errors });
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body || {};
  const errors = [];
  if (!isEmail(email)) errors.push(err('Email is invalid', 'email'));
  if (!String(password || '').trim()) errors.push(err('Password is required', 'password'));
  if (errors.length) return res.status(400).json({ errors });
  next();
};

const validateProfileUpdate = (req, res, next) => {
  const { name, email } = req.body || {};
  const errors = [];
  if (!String(name || '').trim()) errors.push(err('Name is required', 'name'));
  if (!isEmail(email)) errors.push(err('Email is invalid', 'email'));
  if (errors.length) return res.status(400).json({ errors });
  next();
};

const validatePasswordChange = (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  const errors = [];
  if (!String(currentPassword || '').trim()) errors.push(err('Current password is required', 'currentPassword'));
  const nw = String(newPassword || '');
  if (!nw || nw.length < 6) errors.push(err('New password must be at least 6 characters', 'newPassword'));
  if (errors.length) return res.status(400).json({ errors });
  next();
};

const validateHomestayWrite = (req, res, next) => {
  const b = req.body || {};
  const errors = [];

  if (b.title !== undefined) {
    const t = typeof b.title === 'string' ? b.title.trim() : '';
    if (typeof b.title !== 'string' || t.length < 3) {
      errors.push(err('Title must be at least 3 characters', 'title'));
    }
  }
  if (b.description !== undefined) {
    const d = typeof b.description === 'string' ? b.description.trim() : '';
    if (typeof b.description !== 'string' || d.length < 10) {
      errors.push(err('Description must be at least 10 characters', 'description'));
    }
  }
  if (b.location !== undefined) {
    const loc = typeof b.location === 'string' ? b.location.trim() : '';
    if (typeof b.location !== 'string' || !loc) errors.push(err('Location is required', 'location'));
  }
  if (b.address !== undefined && typeof b.address !== 'string') {
    errors.push(err('Address must be text', 'address'));
  }
  if (b.pricePerNight !== undefined) {
    const n = typeof b.pricePerNight === 'number' ? b.pricePerNight : parseFloat(String(b.pricePerNight));
    if (!Number.isFinite(n) || n < 1) {
      errors.push(err('Price per night must be a number >= 1', 'pricePerNight'));
    }
  }
  if (b.checkInWindow !== undefined && typeof b.checkInWindow !== 'string') {
    errors.push(err('checkInWindow must be a string', 'checkInWindow'));
  }
  if (b.checkOutWindow !== undefined && typeof b.checkOutWindow !== 'string') {
    errors.push(err('checkOutWindow must be a string', 'checkOutWindow'));
  }
  if (b.cancellationPolicy !== undefined && typeof b.cancellationPolicy !== 'string') {
    errors.push(err('cancellationPolicy must be a string', 'cancellationPolicy'));
  }

  if (errors.length) return res.status(400).json({ errors });
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateHomestayWrite,
};
