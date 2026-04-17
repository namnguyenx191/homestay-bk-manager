const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  profile,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Email is invalid'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('accountType').optional().isIn(['user', 'host']),
  ],
  register
);
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email is invalid'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);
router.get('/me', protect, profile);
router.put(
  '/me',
  protect,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Email is invalid'),
  ],
  updateProfile
);
router.put(
  '/me/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  changePassword
);

module.exports = router;
