const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Homestay = require('../models/Homestay');

dotenv.config();

const HOST_EMAIL = 'host@homestay.local';
const HOST_PASSWORD = '123456';

const SAMPLE_HOMESTAYS = [
  { title: 'Sunset Beach Villa', location: 'Da Nang', pricePerNight: 78, roomType: 'Entire place' },
  { title: 'Old Quarter Balcony Studio', location: 'Ha Noi', pricePerNight: 46, roomType: 'Private room' },
  { title: 'Saigon River View Loft', location: 'Ho Chi Minh City', pricePerNight: 62, roomType: 'Entire place' },
  { title: 'Sapa Mountain Retreat', location: 'Sapa', pricePerNight: 55, roomType: 'Entire place' },
  { title: 'Hoi An Lantern House', location: 'Hoi An', pricePerNight: 49, roomType: 'Entire place' },
  { title: 'Phu Quoc Palm Bungalow', location: 'Phu Quoc', pricePerNight: 58, roomType: 'Entire place' },
  { title: 'Nha Trang Sea Breeze Room', location: 'Nha Trang', pricePerNight: 43, roomType: 'Private room' },
  { title: 'Da Lat Pine Garden Home', location: 'Da Lat', pricePerNight: 51, roomType: 'Entire place' },
  { title: 'Hue Riverside Homestay', location: 'Hue', pricePerNight: 39, roomType: 'Private room' },
  { title: 'Ha Long Bay Panorama Stay', location: 'Ha Long', pricePerNight: 66, roomType: 'Entire place' },
];

const DEFAULT_ADD_ONS = [
  { name: 'Breakfast', description: 'Morning set menu', unit: 'set', price: 8, active: true },
  { name: 'Lunch combo', description: 'Vietnamese lunch combo', unit: 'meal', price: 12, active: true },
  { name: 'Dinner combo', description: 'Dinner with local dishes', unit: 'meal', price: 15, active: true },
  { name: 'Soft drink', description: 'Coke, soda, juice', unit: 'can', price: 2, active: true },
  { name: 'Beer', description: 'Local bottled beer', unit: 'bottle', price: 3, active: true },
];

const fallbackImage = (index) =>
  `https://images.unsplash.com/photo-${1500000000000 + index * 98765}?auto=format&fit=crop&w=1400&q=80`;

const seedHostHomestays = async () => {
  try {
    await connectDB();

    let host = await User.findOne({ email: HOST_EMAIL });
    if (!host) {
      const hashedPassword = await bcrypt.hash(HOST_PASSWORD, 10);
      host = await User.create({
        name: 'Demo Host',
        email: HOST_EMAIL,
        password: hashedPassword,
        role: 'host',
      });
    } else if (host.role !== 'host') {
      host.role = 'host';
      await host.save();
    }

    for (let i = 0; i < SAMPLE_HOMESTAYS.length; i += 1) {
      const item = SAMPLE_HOMESTAYS[i];
      await Homestay.findOneAndUpdate(
        { ownerId: host._id, title: item.title },
        {
          title: item.title,
          description: `${item.title} is a cozy stay in ${item.location}, suitable for short trips and long stays.`,
          location: item.location,
          address: `${i + 10} Travel Street, ${item.location}, Vietnam`,
          roomType: item.roomType,
          roomSummary: {
            guests: item.roomType === 'Private room' ? 2 : 4,
            bedrooms: item.roomType === 'Private room' ? 1 : 2,
            beds: item.roomType === 'Private room' ? 1 : 2,
            bathrooms: 1,
          },
          pricePerNight: item.pricePerNight,
          images: [fallbackImage(i), fallbackImage(i + 100)],
          amenities: ['WiFi', 'Air conditioning', 'Hot water', 'Workspace'],
          highlights: ['City access', 'Self check-in', 'Clean and quiet'],
          houseRules: ['No smoking', 'No parties', 'Check-in after 14:00'],
          serviceAddOns: DEFAULT_ADD_ONS,
          checkInWindow: '14:00 - 22:00',
          checkOutWindow: '08:00 - 12:00',
          cancellationPolicy: 'Free cancellation within 24 hours.',
          rating: 4.4 + (i % 5) * 0.1,
          reviewCount: 10 + i * 3,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('Seed host homestays completed:');
    console.log(`- host account: ${HOST_EMAIL} / ${HOST_PASSWORD}`);
    console.log(`- homestays upserted: ${SAMPLE_HOMESTAYS.length}`);
  } catch (error) {
    console.error('Seed host homestays failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedHostHomestays();
