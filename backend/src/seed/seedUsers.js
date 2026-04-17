const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

const seedUsers = async () => {
  try {
    await connectDB();

    const users = [
      {
        name: 'System Admin',
        email: 'admin@homestay.local',
        password: '123456',
        role: 'admin',
      },
      {
        name: 'Demo User',
        email: 'user@homestay.local',
        password: '123456',
        role: 'user',
      },
    ];

    for (const item of users) {
      const hashedPassword = await bcrypt.hash(item.password, 10);
      await User.findOneAndUpdate(
        { email: item.email },
        {
          name: item.name,
          email: item.email,
          password: hashedPassword,
          role: item.role,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('Seed users completed:');
    console.log('- admin@homestay.local / 123456 (admin)');
    console.log('- user@homestay.local / 123456 (user)');
  } catch (error) {
    console.error('Seed users failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedUsers();
