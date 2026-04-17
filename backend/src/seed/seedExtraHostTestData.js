const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Homestay = require('../models/Homestay');

dotenv.config();

const PRIMARY_HOST_EMAIL = 'host@homestay.local';
const SECOND_HOST_EMAIL = 'host2@homestay.local';
const DEFAULT_PASSWORD = '123456';

const fiveImageSet = [
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
];

const host2Homes = [
  { title: 'Host2 - Da Nang Ocean View', location: 'Da Nang', pricePerNight: 72 },
  { title: 'Host2 - Hanoi City Nest', location: 'Ha Noi', pricePerNight: 44 },
  { title: 'Host2 - Saigon Central Loft', location: 'Ho Chi Minh City', pricePerNight: 61 },
  { title: 'Host2 - Da Lat Hillside House', location: 'Da Lat', pricePerNight: 53 },
  { title: 'Host2 - Hoi An River Home', location: 'Hoi An', pricePerNight: 49 },
];

const ensureHost = async (email, name) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      password: await bcrypt.hash(DEFAULT_PASSWORD, 10),
      role: 'host',
    });
    return user;
  }
  if (user.role !== 'host') {
    user.role = 'host';
    await user.save();
  }
  return user;
};

const upsertSecondHostHomes = async (host) => {
  for (const [idx, item] of host2Homes.entries()) {
    await Homestay.findOneAndUpdate(
      { ownerId: host._id, title: item.title },
      {
        title: item.title,
        description: `${item.title} - sample listing for testing host dashboard.`,
        location: item.location,
        address: `${100 + idx} Sample Street, ${item.location}, Vietnam`,
        roomType: 'Entire place',
        roomSummary: { guests: 4, bedrooms: 2, beds: 2, bathrooms: 1 },
        pricePerNight: item.pricePerNight,
        images: fiveImageSet,
        amenities: ['WiFi', 'Air conditioning', 'Kitchen', 'Washer'],
        highlights: ['Fast check-in', 'Quiet area', 'Near attractions'],
        houseRules: ['No smoking', 'No parties'],
        checkInWindow: '14:00 - 22:00',
        checkOutWindow: '08:00 - 12:00',
        cancellationPolicy: 'Free cancellation within 24 hours.',
        rating: 4.5,
        reviewCount: 12 + idx,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
};

const seedExtraHostTestData = async () => {
  try {
    await connectDB();

    const primaryHost = await ensureHost(PRIMARY_HOST_EMAIL, 'Demo Host');
    const secondHost = await ensureHost(SECOND_HOST_EMAIL, 'Demo Host 2');

    const oneHome = await Homestay.findOne({ ownerId: primaryHost._id }).sort({ createdAt: 1 });
    if (oneHome) {
      oneHome.images = fiveImageSet;
      if (!oneHome.description) {
        oneHome.description = `${oneHome.title} - updated with 5 images for testing.`;
      }
      await oneHome.save();
    }

    await upsertSecondHostHomes(secondHost);

    console.log('Extra host test data seeded:');
    console.log(`- updated 1 homestay to 5 images for: ${PRIMARY_HOST_EMAIL}`);
    console.log(`- second host: ${SECOND_HOST_EMAIL} / ${DEFAULT_PASSWORD}`);
    console.log(`- homestays upserted for second host: ${host2Homes.length}`);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedExtraHostTestData();
