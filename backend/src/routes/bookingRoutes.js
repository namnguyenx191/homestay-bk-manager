const express = require('express');
const {
  createBooking,
  getUserBookings,
  getAdminBookings,
  getHostDashboard,
  updateBookingStatus,
  cancelMyPendingBooking,
  updateBookingAddOns,
  getBankTransferInfo,
  getPaymentCapabilities,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/bank-transfer-info', getBankTransferInfo);
router.get('/payment-capabilities', getPaymentCapabilities);
router.post('/', protect, authorize('user', 'host', 'admin'), createBooking);
router.put('/:id/add-ons', protect, authorize('user', 'host', 'admin'), updateBookingAddOns);
router.delete('/:id/pending', protect, authorize('user', 'host', 'admin'), cancelMyPendingBooking);
router.get('/user', protect, authorize('user', 'host', 'admin'), getUserBookings);
router.get('/host-dashboard', protect, authorize('host'), getHostDashboard);
router.get('/admin', protect, authorize('admin'), getAdminBookings);
router.put('/:id/status', protect, authorize('admin', 'host'), updateBookingStatus);

module.exports = router;
