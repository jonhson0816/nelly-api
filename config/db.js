const mongoose = require('mongoose');
const dns = require('dns');
const { Resolver } = require('dns').promises;

// Use Google's DNS servers to bypass local ISP DNS issues
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  try {
    // Test DNS resolution before connecting
    const testDNS = async () => {
      try {
        const resolver = new Resolver();
        resolver.setServers(['8.8.8.8', '8.8.4.4']);
        
        // Extract cluster name from MONGODB_URI
        const clusterMatch = process.env.MONGODB_URI?.match(/@([^/]+)/);
        const clusterHost = clusterMatch ? clusterMatch[1] : 'clustermytech.sms2h.mongodb.net';
        
        const addresses = await resolver.resolveSrv(`_mongodb._tcp.${clusterHost}`);
        console.log('✓ DNS resolution successful:', addresses.length, 'records found');
        return true;
      } catch (err) {
        console.error('✗ DNS resolution failed:', err.message);
        return false;
      }
    };

    // Check DNS first
    const dnsWorking = await testDNS();
    
    if (!dnsWorking) {
      console.log('⚠ DNS issues detected. Attempting connection anyway...');
    }

    // Mongoose connection options
    const mongooseOptions = {
      serverSelectionTimeoutMS: 30000, // Increased timeout
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('✓ Mongoose connected to MongoDB Atlas');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Mongoose reconnected to MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('⚠️  MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.log('⚠️  Please check:');
    console.log('   1. Your internet connection');
    console.log('   2. MongoDB Atlas IP whitelist (should include 0.0.0.0/0)');
    console.log('   3. MongoDB Atlas cluster is running');
    console.log('   4. MONGODB_URI in .env is correct');
    console.log('   5. Try changing your DNS to Google DNS (8.8.8.8)');
    console.error('\nConnection string (hidden password):', 
      process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    process.exit(1);
  }
};

module.exports = connectDB;