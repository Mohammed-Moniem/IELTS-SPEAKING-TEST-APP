/**
 * Find user by ID from JWT
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ielts-speaking';
const USER_ID = '68ea5227471c2c2257af0fa5'; // From JWT sub claim

async function findUserById() {
  try {
    await mongoose.connect(MONGO_URI);

    const usersCollection = mongoose.connection.db.collection('users');
    const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(USER_ID) });

    if (user) {
      console.log('✅ Found user!');
      console.log(JSON.stringify(user, null, 2));

      if (user.phone && user.phone.match(/(\+\d{1,4})\1/)) {
        console.log('\n🔧 Phone has duplicated country code!');
        console.log('Current:', user.phone);

        // Fix it
        const fixed = user.phone.replace(/^(\+\d{1,4})+/, match => {
          const codes = match.match(/\+\d{1,4}/g);
          return codes[0]; // Keep only first country code
        });

        console.log('Fixed:', fixed);

        await usersCollection.updateOne({ _id: user._id }, { $set: { phone: fixed } });

        console.log('✅ Phone number fixed!');
      } else if (user.phone) {
        console.log('\n✅ Phone looks correct:', user.phone);
      } else {
        console.log('\n⚠️ No phone number found');
      }
    } else {
      console.log('❌ User not found with ID:', USER_ID);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

findUserById();
