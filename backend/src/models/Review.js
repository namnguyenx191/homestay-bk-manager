const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homestayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homestay', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, homestayId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
