const express = require('express');
const {
  createBooking,
  getUserBookings,
  getAdminBookings,
  getHostDashboard,
  updateBookingStatus,
  checkInBookingByHost,
  checkOutBookingByHost,
  createWalkInCheckInByHost,
  cancelMyPendingBooking,
  updateBookingAddOns,
  getBankTransferInfo,
  getPaymentCapabilities,
  createMomoQrForBooking,
  createVietQrForBooking,
  confirmTransferByBot,
  momoWebhook,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/bank-transfer-info', getBankTransferInfo);
router.get('/payment-capabilities', getPaymentCapabilities);
router.post('/bot/confirm-transfer', confirmTransferByBot);
router.post('/webhook/momo', momoWebhook);
router.post('/momo/qr', protect, authorize('user', 'host', 'admin'), createMomoQrForBooking);
router.post('/vietqr', protect, authorize('user', 'host', 'admin'), createVietQrForBooking);
router.post('/', protect, authorize('user', 'host', 'admin'), createBooking);
router.put('/:id/add-ons', protect, authorize('user', 'host', 'admin'), updateBookingAddOns);
router.delete('/:id/pending', protect, authorize('user', 'host', 'admin'), cancelMyPendingBooking);
router.get('/user', protect, authorize('user', 'host', 'admin'), getUserBookings);
router.get('/host-dashboard', protect, authorize('host'), getHostDashboard);
router.get('/admin', protect, authorize('admin'), getAdminBookings);
router.put('/:id/status', protect, authorize('admin'), updateBookingStatus);
router.put('/:id/check-in', protect, authorize('host', 'admin'), checkInBookingByHost);
router.put('/:id/check-out', protect, authorize('host', 'admin'), checkOutBookingByHost);
router.post('/host/walk-in-checkin', protect, authorize('host', 'admin'), createWalkInCheckInByHost);

module.exports = router;
