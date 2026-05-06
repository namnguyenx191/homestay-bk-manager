const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri || !String(uri).trim()) {
    console.error('MongoDB connection failed: MONGO_URI is empty. Set it in backend/.env');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      family: 4,
    });
    console.log('MongoDB connected');
  } catch (error) {
    const code = error.code || error.name;
    console.error(`MongoDB connection failed (${code}): ${error.message}`);
    console.error('Kiem tra: Mongo dang chay (Docker homestay-mongo hoac brew), va MONGO_URI trong backend/.env dung host/port.');
    process.exit(1);
  }
};

module.exports = connectDB;
