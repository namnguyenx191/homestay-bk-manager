const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    province: { type: String, default: 'Khác', trim: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: '', trim: true },
    unit: { type: String, default: 'unit', trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);

