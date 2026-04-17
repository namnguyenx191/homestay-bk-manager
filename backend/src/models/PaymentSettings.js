const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema(
  {
    bankQrImageUrl: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },
    branch: { type: String, default: '' },
    swift: { type: String, default: '' },
    instructions: { type: String, default: '' },
  },
  { timestamps: true }
);

const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

const getPaymentSettings = async () => {
  let doc = await PaymentSettings.findOne();
  if (!doc) doc = await PaymentSettings.create({});
  return doc;
};

module.exports = { PaymentSettings, getPaymentSettings };
