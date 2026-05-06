const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homestayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homestay', required: true },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    serviceFee: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['card', 'bank_transfer', 'cash'], default: 'card' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
      default: 'pending',
    },
    addOns: [
      {
        serviceName: { type: String, required: true },
        unit: { type: String, default: 'item' },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
      },
    ],
    addOnsTotal: { type: Number, default: 0 },
    addOnsFinalized: { type: Boolean, default: false },
    addOnPaymentMethod: { type: String, enum: ['card', 'bank_transfer', null], default: null },
    addOnPaymentStatus: { type: String, enum: ['none', 'pending', 'paid', 'failed'], default: 'none' },
    addOnStripeSessionId: { type: String, default: null },
    addOnStripePaymentIntentId: { type: String, default: null },
    addOnBankTransferReference: { type: String, default: null },
    addOnBankTransferNote: { type: String, default: null },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    bankTransferReference: { type: String, default: null },
    bankTransferNote: { type: String, default: null },
    guestName: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
    /** Paid stay, still checked_in after checkOutDate — extra nights × nightly rate */
    overstayFeeAccrued: { type: Number, default: 0 },
    /** Last full-day count we used for notifications / fee (avoids duplicate toasts) */
    overstayDaysNotified: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
