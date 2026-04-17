const express = require('express');
const { getWishlist, toggleWishlist } = require('../controllers/wishlistController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, authorize('user', 'host', 'admin'), getWishlist);
router.post('/toggle', protect, authorize('user', 'host', 'admin'), toggleWishlist);

module.exports = router;
