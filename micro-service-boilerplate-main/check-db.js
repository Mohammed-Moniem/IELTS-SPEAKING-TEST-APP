/**
 * Script to check database collections and user data
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ielts-speaking';

async function checkDatabase() {
  await mongoose.connect(MONGO_URI);
  try {
    console.log('🔍 Checking database...');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📊 Collections:', collections.map(c => c.name).join(', '));

    // Check users collection
    const usersCollection = mongoose.connection.db.collection('users');
    const userCount = await usersCollection.countDocuments();
    console.log(`\n👥 Users collection: ${userCount} documents`);

    // Get a sample user
    const sampleUser = await usersCollection.findOne({});
    if (sampleUser) {
      console.log('\n📝 Sample user:');
      console.log(JSON.stringify(sampleUser, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkDatabase();
