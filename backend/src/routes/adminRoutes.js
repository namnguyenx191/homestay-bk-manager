const express = require('express');
const {
  getStats,
  getUsers,
  deleteUserAccount,
  getPaymentSettingsAdmin,
  getRevenueReport,
  updatePaymentSettings,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/stats', protect, authorize('admin', 'host'), getStats);
router.get('/revenue-report', protect, authorize('admin', 'host'), getRevenueReport);
router.get('/users', protect, authorize('admin'), getUsers);
router.delete('/users/:id', protect, authorize('admin'), deleteUserAccount);
router.get('/payment-settings', protect, authorize('admin', 'host'), getPaymentSettingsAdmin);
router.put('/payment-settings', protect, authorize('admin', 'host'), updatePaymentSettings);

module.exports = router;
