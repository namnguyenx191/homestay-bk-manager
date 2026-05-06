const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Homestay = require('../models/Homestay');

dotenv.config();

const HOST_EMAIL = 'host@homestay.local';
const HOST_PASSWORD = '123456';

/** Quận Thanh Khê — tọa độ gần đúng để map hiển thị phân tán trong ~10km */
const THANH_KHE = [
  { lat: 16.0702, lng: 108.1835 },
  { lat: 16.0671, lng: 108.1874 },
  { lat: 16.0724, lng: 108.1812 },
];

const SAMPLE_HOMESTAYS = [
  {
    title: 'Sunset Beach Villa',
    location: 'Thanh Khê, Đà Nẵng',
    address: '15 Đường Thanh Sơn, phường Thanh Khê Đông, Thanh Khê, Đà Nẵng',
    geo: THANH_KHE[0],
    pricePerNight: 78,
    roomType: 'Entire place',
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    title: 'Thanh Khê Riverside Room',
    location: 'Thanh Khê, Đà Nẵng',
    address: '88 Đường Trần Xuân Soạn, phường Tân Chính, Thanh Khê, Đà Nẵng',
    geo: THANH_KHE[1],
    pricePerNight: 42,
    roomType: 'Private room',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    title: 'Cozy Corner Thanh Khê',
    location: 'Thanh Khê, Đà Nẵng',
    address: '42 Nguyễn Tri Phương, phường Thanh Khê Tây, Thanh Khê, Đà Nẵng',
    geo: THANH_KHE[2],
    pricePerNight: 55,
    roomType: 'Entire place',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
    ],
  },
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

/** Ảnh Unsplash hợp lệ (fallback cho listing không khai báo images) */
const GENERIC_STAY_IMAGES = [
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
];

const galleryForIndex = (index) => {
  const a = GENERIC_STAY_IMAGES[index % GENERIC_STAY_IMAGES.length];
  const b = GENERIC_STAY_IMAGES[(index + 3) % GENERIC_STAY_IMAGES.length];
  return [a, b];
};

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
      const basePayload = {
          title: item.title,
          description: `${item.title} is a cozy stay in ${item.location}, suitable for short trips and long stays.`,
          location: item.location,
          address: item.address || `${i + 10} Travel Street, ${item.location}, Vietnam`,
          roomType: item.roomType,
          roomSummary: {
            guests: item.roomType === 'Private room' ? 2 : 4,
            bedrooms: item.roomType === 'Private room' ? 1 : 2,
            beds: item.roomType === 'Private room' ? 1 : 2,
            bathrooms: 1,
          },
          pricePerNight: item.pricePerNight,
          images: item.images && item.images.length ? item.images : galleryForIndex(i),
          amenities: ['WiFi', 'Air conditioning', 'Hot water', 'Workspace'],
          highlights: ['City access', 'Self check-in', 'Clean and quiet'],
          houseRules: ['No smoking', 'No parties', 'Check-in after 14:00'],
          serviceAddOns: DEFAULT_ADD_ONS,
          checkInWindow: '14:00 - 22:00',
          checkOutWindow: '08:00 - 12:00',
          cancellationPolicy: 'Free cancellation within 24 hours.',
          rating: 4.4 + (i % 5) * 0.1,
          reviewCount: 10 + i * 3,
      };
      if (item.geo && Number.isFinite(item.geo.lat) && Number.isFinite(item.geo.lng)) {
        basePayload.geo = { lat: item.geo.lat, lng: item.geo.lng };
      }
      await Homestay.findOneAndUpdate({ ownerId: host._id, title: item.title }, basePayload, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
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
