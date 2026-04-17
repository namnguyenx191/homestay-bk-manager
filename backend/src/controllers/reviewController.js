const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Homestay = require('../models/Homestay');

const refreshRating = async (homestayId) => {
  const stats = await Review.aggregate([
    { $match: { homestayId } },
    { $group: { _id: '$homestayId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Homestay.findByIdAndUpdate(homestayId, {
    rating: stats[0]?.avg || 0,
    reviewCount: stats[0]?.count || 0,
  });
};

const addReview = async (req, res) => {
  const { homestayId, rating, comment } = req.body;

  const hasCompletedStay = await Booking.countDocuments({
    userId: req.user._id,
    homestayId,
    status: 'confirmed',
    checkOutDate: { $lte: new Date() },
  });

  if (!hasCompletedStay) {
    return res.status(400).json({ message: 'Only guests with completed stays can review' });
  }

  const review = await Review.findOneAndUpdate(
    { userId: req.user._id, homestayId },
    { rating, comment },
    { new: true, upsert: true }
  );

  await refreshRating(homestayId);
  res.status(201).json(review);
};

const getReviewsByHomestay = async (req, res) => {
  const reviews = await Review.find({ homestayId: req.params.homestayId })
    .populate('userId', 'name')
    .sort({ createdAt: -1 });

  res.json(reviews);
};

const getReviewSummary = async (req, res) => {
  const homestayId = req.params.homestayId;
  const reviews = await Review.find({ homestayId }).select('rating');
  const totalReviews = reviews.length;
  const averageRating = totalReviews ? reviews.reduce((sum, item) => sum + item.rating, 0) / totalReviews : 0;
  const ratingBuckets = [5, 4, 3, 2, 1].map((value) => ({
    rating: value,
    count: reviews.filter((item) => item.rating === value).length,
  }));

  res.json({
    totalReviews,
    averageRating,
    ratingBuckets,
    categoryScores: {
      cleanliness: averageRating ? Math.min(5, averageRating + 0.1) : 0,
      comfort: averageRating ? Math.min(5, averageRating + 0.2) : 0,
      location: averageRating ? Math.min(5, averageRating + 0.15) : 0,
      value: averageRating ? Math.min(5, averageRating + 0.05) : 0,
      staff: averageRating ? Math.min(5, averageRating + 0.1) : 0,
    },
  });
};

module.exports = { addReview, getReviewsByHomestay, getReviewSummary };
