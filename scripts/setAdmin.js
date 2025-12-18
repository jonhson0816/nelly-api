const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const setAdminUser = async () => {
  try {
    // Use MONGODB_URI (matches your .env file)
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get email from command line argument
    const adminEmail = process.argv[2];
    
    if (!adminEmail) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node scripts/setAdmin.js <email>');
      console.log('\nAvailable users:');
      const users = await User.find({}).select('email username firstName lastName role');
      console.table(users.map(u => ({
        email: u.email,
        username: u.username,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role
      })));
      process.exit(1);
    }
    
    const user = await User.findOne({ email: adminEmail });
    
    if (!user) {
      console.log('❌ User not found with email:', adminEmail);
      console.log('\nAvailable users:');
      const users = await User.find({}).select('email username firstName lastName role');
      console.table(users.map(u => ({
        email: u.email,
        username: u.username,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role
      })));
      process.exit(1);
    }

    // Update user role to admin
    user.role = 'admin';
    await user.save();
    
    console.log('✅ Admin role set for:', user.email);
    console.log('User details:', {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isAdmin: user.isAdmin // This is the virtual field
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

setAdminUser();