const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Homestay = require('../models/Homestay');
const InventoryItem = require('../models/InventoryItem');

dotenv.config();

const provinceFromLocation = (location = '') => {
  const parts = String(location)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'Khác';
};

const normalizeName = (s) => String(s || '').trim();

const randomStock = () => 5 + Math.floor(Math.random() * 36); // 5..40

const syncInventoryFromHomestays = async () => {
  try {
    await connectDB();
    const homes = await Homestay.find({}).select('ownerId location serviceAddOns');
    let touched = 0;
    for (const h of homes) {
      const province = provinceFromLocation(h.location);
      const addOns = Array.isArray(h.serviceAddOns) ? h.serviceAddOns : [];
      for (const addOn of addOns) {
        const name = normalizeName(addOn?.name);
        if (!name) continue;
        const unit = normalizeName(addOn?.unit || 'item') || 'item';
        const sku = `ADDON-${name.toUpperCase().replace(/\s+/g, '-').slice(0, 24)}`;
        const qty = randomStock();
        const minQty = Math.max(2, Math.floor(qty * 0.2));
        await InventoryItem.findOneAndUpdate(
          { ownerId: h.ownerId, province, name, unit },
          {
            ownerId: h.ownerId,
            province,
            name,
            unit,
            sku,
            quantity: qty,
            minQuantity: minQty,
            note: 'Synced from existing homestay add-on services',
          },
          { upsert: true, setDefaultsOnInsert: true, new: true }
        );
        touched += 1;
      }
    }
    console.log(`Inventory sync completed. Upserts attempted: ${touched}`);
  } catch (e) {
    console.error('Inventory sync failed:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

syncInventoryFromHomestays();

