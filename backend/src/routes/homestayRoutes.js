const express = require('express');
const { body } = require('express-validator');
const {
  getHomestays,
  getHomestayById,
  createHomestay,
  updateHomestay,
  deleteHomestay,
  checkAvailability,
} = require('../controllers/homestayController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();
/** Accept JSON numbers from axios (isFloat only validates strings and would fail). */
const homestayValidation = [
  body('title').optional().isString().trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').optional().isString().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('location').optional().isString().trim().notEmpty().withMessage('Location is required'),
  body('address').optional().isString().withMessage('Address must be text'),
  body('pricePerNight')
    .optional()
    .custom((v) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) && n >= 1;
    })
    .withMessage('Price per night must be a number >= 1'),
  body('checkInWindow').optional().isString(),
  body('checkOutWindow').optional().isString(),
  body('cancellationPolicy').optional().isString(),
];

router.get('/', getHomestays);
router.get('/:id', getHomestayById);
router.get('/:id/availability', checkAvailability);
router.post('/', protect, authorize('admin', 'host'), homestayValidation, createHomestay);
router.put('/:id', protect, authorize('admin', 'host'), homestayValidation, updateHomestay);
router.delete('/:id', protect, authorize('admin', 'host'), deleteHomestay);

module.exports = router;
