import { config } from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '.env') });

// Import the User model from your codebase
import './src/api/models/UserModel';
const User = mongoose.model('User');

async function createTestUsers() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27018/ielts-speaking';
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    // Password (will be hashed automatically by the model's pre-save hook)
    const password = 'Test123!';

    // Delete existing test users
    await User.deleteMany({
      email: { $in: ['free@test.com', 'premium@test.com', 'pro@test.com'] }
    });
    console.log('🗑️  Cleared existing test users');

    // 1. Create FREE user with limited access
    const freeUser = new User({
      email: 'free@test.com',
      firstName: 'Free',
      lastName: 'User',
      password,
      subscriptionPlan: 'free',
      emailVerified: true
    });
    await freeUser.save();
    console.log('✅ Created FREE user');

    // 2. Create PREMIUM user with unlimited access
    const premiumUser = new User({
      email: 'premium@test.com',
      firstName: 'Premium',
      lastName: 'User',
      password,
      subscriptionPlan: 'premium',
      emailVerified: true
    });
    await premiumUser.save();
    console.log('✅ Created PREMIUM user');

    // 3. Create PRO user with unlimited access
    const proUser = new User({
      email: 'pro@test.com',
      firstName: 'Pro',
      lastName: 'User',
      password,
      subscriptionPlan: 'pro',
      emailVerified: true
    });
    await proUser.save();
    console.log('✅ Created PRO user');

    console.log('\n✅ All test users created successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 FREE USER (Limited Access)');
    console.log('   Email: free@test.com');
    console.log('   Password: Test123!');
    console.log('   Plan: FREE');
    console.log('   Limited features and usage');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 PREMIUM USER (Unlimited Access)');
    console.log('   Email: premium@test.com');
    console.log('   Password: Test123!');
    console.log('   Plan: PREMIUM');
    console.log('   Unlimited practice and features');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 PRO USER (Unlimited Access + Advanced Features)');
    console.log('   Email: pro@test.com');
    console.log('   Password: Test123!');
    console.log('   Plan: PRO');
    console.log('   All features + priority support');
    console.log('═══════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestUsers();
