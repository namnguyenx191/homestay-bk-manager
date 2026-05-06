const express = require('express');
const {
  register,
  login,
  profile,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
} = require('../middlewares/simpleBodyValidators');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, profile);
router.put('/me', protect, validateProfileUpdate, updateProfile);
router.put('/me/password', protect, validatePasswordChange, changePassword);

module.exports = router;
