import mongoose from 'mongoose';
import { UserModel } from './src/api/models/UserModel';

async function createTestUser() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/ielts-speaking');
    console.log('✅ Connected to MongoDB\n');

    // Delete if exists
    const existing = await UserModel.findOne({ email: 'test@unlimited.com' });
    if (existing) {
      await UserModel.deleteOne({ email: 'test@unlimited.com' });
      console.log('🗑️  Deleted existing test user\n');
    }

    // Create unlimited access user
    const testUser = await UserModel.create({
      email: 'test@unlimited.com',
      firstName: 'Test',
      lastName: 'User',
      password: await require('bcryptjs').hash('TestPassword123!', 10),
      emailVerified: true,
      subscriptionPlan: 'premium', // Bypass all usage limits
      createdAt: new Date()
    });

    console.log('✅ Test user created successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 TEST USER CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   User ID:      ${testUser._id}`);
    console.log(`   Email:        test@unlimited.com`);
    console.log(`   Password:     TestPassword123!`);
    console.log(`   Name:         Test User`);
    console.log(`   Plan:         premium (unlimited access)`);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('💡 USAGE INSTRUCTIONS:');
    console.log('   1. Copy the User ID above');
    console.log('   2. Update mobile/src/config/constants.ts:');
    console.log('      export const TEST_USER_ID = "' + testUser._id + '";');
    console.log('   3. Or use in development mode for auto-login');
    console.log('   4. This user has unlimited practices and simulations\n');
    console.log('🎯 This user bypasses all usage limits and rate restrictions');
    console.log('   Perfect for testing full simulation mode and all features!\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createTestUser();
