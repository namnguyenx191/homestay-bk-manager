const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Homestay = require('../models/Homestay');

dotenv.config();

const IMAGES_PER_HOME = 4;

const IMAGE_POOLS = {
  beach: [
    'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
    'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1600&q=80',
    'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1600&q=80',
    'https://images.unsplash.com/photo-1493558103817-58b2924bce98?w=1600&q=80',
  ],
  mountain: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1600&q=80',
    'https://images.unsplash.com/photo-1464823063530-08f10ed1a2dd?w=1600&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=80',
    'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1600&q=80',
  ],
  heritage: [
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&q=80',
    'https://images.unsplash.com/photo-1536724239846-5aaeea8f5eb8?w=1600&q=80',
    'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?w=1600&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80',
    'https://images.unsplash.com/photo-1533856493584-0c6ca8ca9ce3?w=1600&q=80',
    'https://images.unsplash.com/photo-1528164344705-47542687000d?w=1600&q=80',
  ],
  city: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1600&q=80',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
    'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600&q=80',
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1600&q=80',
    'https://images.unsplash.com/photo-1468436385273-8abca6dfd8d3?w=1600&q=80',
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&q=80',
  ],
  interior: [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1600&q=80',
    'https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&q=80',
  ],
};

const DEFAULT_POOL = [...IMAGE_POOLS.interior, ...IMAGE_POOLS.city];

const pickImages = (pool, seed, count = IMAGES_PER_HOME) => {
  const out = [];
  let idx = Math.abs(seed) % pool.length;
  while (out.length < count) {
    const url = pool[idx % pool.length];
    if (!out.includes(url)) out.push(url);
    idx += 3;
  }
  return out;
};

const hashString = (text = '') => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return h;
};

const detectPoolByLocation = (location = '') => {
  const loc = String(location).toLowerCase();
  if (/phu quoc|nha trang|da nang|vung tau|ha long|beach|coast|island/.test(loc)) return 'beach';
  if (/sapa|da lat|moc chau|mountain|hill/.test(loc)) return 'mountain';
  if (/hoi an|hue|ha noi|old quarter|heritage/.test(loc)) return 'heritage';
  if (/ho chi minh|hcm|saigon|city|urban|kuala|bangkok|singapore|hong kong/.test(loc)) return 'city';
  return 'interior';
};

const seedHomestayImages = async () => {
  try {
    await connectDB();
    const homes = await Homestay.find().select('_id title location images');
    let updated = 0;

    for (const home of homes) {
      const poolName = detectPoolByLocation(home.location);
      const primaryPool = IMAGE_POOLS[poolName] || IMAGE_POOLS.interior;
      const combinedPool = [...primaryPool, ...DEFAULT_POOL.filter((url) => !primaryPool.includes(url))];
      const seed = hashString(`${home.title || ''}-${home.location || ''}`);
      home.images = pickImages(combinedPool, seed, IMAGES_PER_HOME);
      await home.save();
      updated += 1;
    }

    console.log(`Homestay image seed completed. Updated ${updated}/${homes.length} homestays.`);
  } catch (error) {
    console.error('Homestay image seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedHomestayImages();
