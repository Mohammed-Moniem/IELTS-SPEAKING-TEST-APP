// @ts-nocheck
import * as bcrypt from 'bcrypt';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SubscriptionStatus, SubscriptionTier, User } from './src/api/models/User';

// Database configuration (update with your actual config)
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_HOST || 'localhost',
  port: parseInt(process.env.TYPEORM_PORT || '5432'),
  username: process.env.TYPEORM_USERNAME || 'postgres',
  password: process.env.TYPEORM_PASSWORD || 'postgres',
  database: process.env.TYPEORM_DATABASE || 'ielts_practice',
  entities: ['src/api/models/**/*.ts'],
  synchronize: false
});

async function createTestUsers() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const userRepository = AppDataSource.getRepository(User);

    // Hash password
    const password = 'Test123!';
    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Create FREE user with limited access
    const freeUser = userRepository.create({
      email: 'free@test.com',
      name: 'Free User',
      passwordHash,
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      practiceSessionsUsed: 3, // Already used 3 out of 5
      simulationSessionsUsed: 1, // Already used 1 out of 2
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Reset in 30 days
      isEmailVerified: true,
      isActive: true,
      preferences: {
        language: 'en',
        notifications: true,
        difficulty: 'medium'
      }
    });

    // 2. Create PREMIUM user with unlimited access
    const premiumUser = userRepository.create({
      email: 'premium@test.com',
      name: 'Premium User',
      passwordHash,
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Started 15 days ago
      subscriptionEndDate: new Date(Date.now() + 345 * 24 * 60 * 60 * 1000), // Ends in 345 days (1 year total)
      practiceSessionsUsed: 25,
      simulationSessionsUsed: 10,
      usageResetDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      isEmailVerified: true,
      isActive: true,
      preferences: {
        language: 'en',
        notifications: true,
        difficulty: 'hard'
      }
    });

    // 3. Create PRO user with unlimited access
    const proUser = userRepository.create({
      email: 'pro@test.com',
      name: 'Pro User',
      passwordHash,
      subscriptionTier: SubscriptionTier.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Started 60 days ago
      subscriptionEndDate: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000), // Ends in 305 days
      practiceSessionsUsed: 150,
      simulationSessionsUsed: 75,
      usageResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isEmailVerified: true,
      isActive: true,
      preferences: {
        language: 'en',
        notifications: true,
        difficulty: 'hard'
      }
    });

    // Delete existing test users if they exist
    await userRepository.delete({ email: 'free@test.com' });
    await userRepository.delete({ email: 'premium@test.com' });
    await userRepository.delete({ email: 'pro@test.com' });

    // Save new users
    await userRepository.save(freeUser);
    await userRepository.save(premiumUser);
    await userRepository.save(proUser);

    console.log('\n✅ Test users created successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 FREE USER (Limited Access)');
    console.log('   Email: free@test.com');
    console.log('   Password: Test123!');
    console.log('   Tier: FREE');
    console.log('   Practice sessions used: 3/5');
    console.log('   Simulation sessions used: 1/2');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 PREMIUM USER (Unlimited Access)');
    console.log('   Email: premium@test.com');
    console.log('   Password: Test123!');
    console.log('   Tier: PREMIUM');
    console.log('   Practice sessions: 25 (unlimited)');
    console.log('   Simulation sessions: 10 (unlimited)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 PRO USER (Unlimited Access)');
    console.log('   Email: pro@test.com');
    console.log('   Password: Test123!');
    console.log('   Tier: PRO');
    console.log('   Practice sessions: 150 (unlimited)');
    console.log('   Simulation sessions: 75 (unlimited)');
    console.log('═══════════════════════════════════════════════════════════\n');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

createTestUsers();
