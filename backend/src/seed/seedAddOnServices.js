const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Homestay = require('../models/Homestay');

dotenv.config();

const DEFAULT_ADD_ONS = [
  { name: 'Breakfast', description: 'Morning set menu', unit: 'set', price: 8, active: true },
  { name: 'Lunch combo', description: 'Vietnamese lunch combo', unit: 'meal', price: 12, active: true },
  { name: 'Dinner combo', description: 'Dinner with local dishes', unit: 'meal', price: 15, active: true },
  { name: 'Soft drink', description: 'Coke, soda, juice', unit: 'can', price: 2, active: true },
  { name: 'Beer', description: 'Local bottled beer', unit: 'bottle', price: 3, active: true },
];

const mergeAddOns = (existing = []) => {
  const byName = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((item) => item?.name)
      .map((item) => [String(item.name).trim().toLowerCase(), item])
  );

  for (const addon of DEFAULT_ADD_ONS) {
    const key = addon.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, addon);
  }

  return [...byName.values()].map((item) => ({
    name: String(item.name || '').trim(),
    description: String(item.description || '').trim(),
    unit: String(item.unit || 'item').trim() || 'item',
    price: Number(item.price || 0),
    active: item.active !== false,
  }));
};

const seedAddOnServices = async () => {
  try {
    await connectDB();
    const homes = await Homestay.find().select('_id title serviceAddOns');
    let updated = 0;

    for (const home of homes) {
      const merged = mergeAddOns(home.serviceAddOns);
      const changed = JSON.stringify(merged) !== JSON.stringify(home.serviceAddOns || []);
      if (!changed) continue;
      home.serviceAddOns = merged;
      await home.save();
      updated += 1;
    }

    console.log(`Add-on seed completed. Updated ${updated}/${homes.length} homestays.`);
  } catch (error) {
    console.error('Add-on seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedAddOnServices();
