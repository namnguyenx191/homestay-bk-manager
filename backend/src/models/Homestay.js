const mongoose = require('mongoose');

const homestaySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    address: { type: String, default: '' },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    roomType: { type: String, default: 'Entire place' },
    roomSummary: {
      guests: { type: Number, default: 2 },
      bedrooms: { type: Number, default: 1 },
      beds: { type: Number, default: 1 },
      bathrooms: { type: Number, default: 1 },
    },
    pricePerNight: { type: Number, required: true },
    images: [{ type: String }],
    amenities: [{ type: String }],
    highlights: [{ type: String }],
    houseRules: [{ type: String }],
    checkInWindow: { type: String, default: '14:00 - 22:00' },
    checkOutWindow: { type: String, default: '08:00 - 12:00' },
    cancellationPolicy: { type: String, default: 'Free cancellation within 24 hours.' },
    serviceAddOns: [
      {
        name: { type: String, required: true },
        description: { type: String, default: '' },
        price: { type: Number, required: true, min: 0 },
        unit: { type: String, default: 'item' },
        active: { type: Boolean, default: true },
      },
    ],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Homestay', homestaySchema);
