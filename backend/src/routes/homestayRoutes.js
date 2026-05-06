const express = require('express');
const {
  getHomestays,
  getHomestayById,
  createHomestay,
  updateHomestay,
  deleteHomestay,
  checkAvailability,
} = require('../controllers/homestayController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateHomestayWrite } = require('../middlewares/simpleBodyValidators');

const router = express.Router();

router.get('/', getHomestays);
router.get('/:id', getHomestayById);
router.get('/:id/availability', checkAvailability);
router.post('/', protect, authorize('admin', 'host'), validateHomestayWrite, createHomestay);
router.put('/:id', protect, authorize('admin', 'host'), validateHomestayWrite, updateHomestay);
router.delete('/:id', protect, authorize('admin', 'host'), deleteHomestay);

module.exports = router;
