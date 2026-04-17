const express = require('express');
const { addReview, getReviewsByHomestay, getReviewSummary } = require('../controllers/reviewController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', protect, authorize('user', 'host', 'admin'), addReview);
router.get('/:homestayId/summary', getReviewSummary);
router.get('/:homestayId', getReviewsByHomestay);

module.exports = router;
