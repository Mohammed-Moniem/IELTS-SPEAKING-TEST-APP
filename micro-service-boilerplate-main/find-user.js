/**
 * Script to find all users and check for phone issues
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ielts-speaking';

async function findAllUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔍 Searching all collections for users...\n');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Collections:', collections.map(c => c.name).join(', '));

    // Check each collection for user data
    for (const coll of collections) {
      const collection = mongoose.connection.db.collection(coll.name);
      const docs = await collection.find({}).limit(5).toArray();

      if (docs.length > 0) {
        console.log(`\n📁 ${coll.name} (${docs.length} docs shown):`);
        docs.forEach((doc, i) => {
          console.log(`  ${i + 1}. ${JSON.stringify(doc).substring(0, 200)}...`);
        });
      }
    }

    // Specifically search for user with email pro@test.com
    console.log('\n\n🔍 Searching for pro@test.com...');
    const usersCollection = mongoose.connection.db.collection('users');
    const proUser = await usersCollection.findOne({ email: 'pro@test.com' });

    if (proUser) {
      console.log('✅ Found!');
      console.log(JSON.stringify(proUser, null, 2));
    } else {
      console.log('❌ Not found in users collection');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

findAllUsers();
