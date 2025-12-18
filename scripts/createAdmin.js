// ============================================
// CREATE ADMIN USER SCRIPT - FIXED VERSION
// ============================================
// Save this as: scripts/createAdmin.js
// Run with: node scripts/createAdmin.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Debug: Check if .env loaded
console.log('🔍 Checking environment variables...');
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Try different possible variable names
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ MongoDB URI not found in .env file!');
  console.error('Please check your .env file has one of these:');
  console.error('  - MONGO_URI=...');
  console.error('  - MONGODB_URI=...');
  console.error('  - DATABASE_URL=...');
  process.exit(1);
}

console.log('✅ MongoDB URI found');
console.log('');

// User Schema (simplified - matches your User model)
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  username: { type: String, unique: true },
  avatar: Object,
  bio: String,
  location: String,
  dateOfBirth: Date,
  role: { type: String, default: 'user' },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  stats: {
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    posts: { type: Number, default: 0 }
  },
  badges: [String],
  loginCount: { type: Number, default: 0 },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdminUser() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ isAdmin: true });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists!');
      console.log('');
      console.log('📋 Existing Admin Details:');
      console.log('   ID:', existingAdmin._id.toString());
      console.log('   Name:', `${existingAdmin.firstName} ${existingAdmin.lastName}`);
      console.log('   Username:', existingAdmin.username);
      console.log('   Email:', existingAdmin.email);
      console.log('   isAdmin:', existingAdmin.isAdmin);
      console.log('   role:', existingAdmin.role);
      console.log('');
      console.log('ℹ️ If you want to create a different admin, delete this one first');
      console.log('   or use the makeUserAdmin.js script instead.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create new admin user
    console.log('👤 Creating new admin user...');
    const hashedPassword = await bcrypt.hash('admin123456', 10);
    
    const adminUser = await User.create({
      firstName: 'Nelly',
      lastName: 'Korda',
      email: 'nellykorda@admin.com',
      password: hashedPassword,
      username: 'nellykorda',
      bio: 'Professional Golfer | World No. 1 🏆⛳',
      location: 'Bradenton, Florida',
      dateOfBirth: new Date('1998-07-28'),
      role: 'admin',
      isAdmin: true,
      isVerified: true,
      isActive: true,
      avatar: {
        url: 'https://res.cloudinary.com/demo/image/upload/v1/golf_player.jpg',
        publicId: 'default_admin_avatar'
      },
      stats: {
        followers: 0,
        following: 0,
        posts: 0
      },
      badges: ['Admin', 'Verified'],
      loginCount: 0
    });

    console.log('');
    console.log('🎉 ═══════════════════════════════════════════════════════');
    console.log('✅ Admin user created successfully!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 ADMIN LOGIN CREDENTIALS:');
    console.log('');
    console.log('   📧 Email:    nellykorda@admin.com');
    console.log('   🔑 Password: admin123456');
    console.log('   👤 Username: nellykorda');
    console.log('   🆔 ID:       ' + adminUser._id.toString());
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 IMPORTANT: Change the password after first login!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error creating admin user:');
    console.error('');
    
    if (error.code === 11000) {
      console.error('⚠️ Duplicate key error - A user with this email or username already exists!');
      console.error('   Email: nellykorda@admin.com');
      console.error('   Username: nellykorda');
      console.error('');
      console.error('💡 Solution: Either:');
      console.error('   1. Delete the existing user from MongoDB');
      console.error('   2. Change the email/username in the script');
      console.error('   3. Use makeUserAdmin.js to promote an existing user');
    } else {
      console.error(error);
    }
    
    console.error('');
    process.exit(1);
  }
}

createAdminUser();