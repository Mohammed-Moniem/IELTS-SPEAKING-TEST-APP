/**
 * Script to fix duplicated country codes in phone numbers
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ielts-speaking';

async function fixPhoneNumbers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔍 Finding users with phone numbers...');

    const usersCollection = mongoose.connection.db.collection('users');

    // Find all users
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`📊 Total users: ${allUsers.length}`);

    for (const user of allUsers) {
      console.log(`\n👤 User: ${user.email || user._id}`);
      console.log(`   Phone: ${user.phone || 'none'}`);

      if (user.phone && user.phone.includes('+971+971')) {
        // Fix duplicated country code
        const fixed = user.phone.replace(/(\+\d{1,4})+/, '+971');
        console.log(`   🔧 Fixing to: ${fixed}`);

        await usersCollection.updateOne({ _id: user._id }, { $set: { phone: fixed } });
        console.log('   ✅ Fixed!');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixPhoneNumbers();
