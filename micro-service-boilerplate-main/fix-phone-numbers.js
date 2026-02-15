/**
 * Script to fix duplicated country codes in phone numbers
 * Run with: node fix-phone-numbers.js
 */

const mongoose = require('mongoose');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ielts-speaking';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema(
  {
    phone: String,
    firstName: String,
    lastName: String,
    email: String
  },
  { collection: 'users' }
);

const User = mongoose.model('User', UserSchema);

async function fixPhoneNumbers() {
  try {
    console.log('🔍 Finding users with duplicated country codes...');

    // Find all users with phone numbers
    const users = await User.find({ phone: { $exists: true, $ne: null } });

    console.log(`📊 Found ${users.length} users with phone numbers`);

    let fixedCount = 0;

    for (const user of users) {
      if (!user.phone) continue;

      // Check if phone has duplicated country codes (e.g., +971+971 or +971+971+971)
      const hasDuplicates = user.phone.match(/(\+\d{1,4})\1/);

      if (hasDuplicates) {
        // Extract just one country code and the number
        const matches = user.phone.match(/^(\+\d{1,4})+(.*)$/);
        if (matches) {
          const countryCode = matches[1];
          const phoneNumber = matches[2];
          const fixedPhone = countryCode + phoneNumber;

          console.log(`🔧 Fixing ${user.email || user._id}:`);
          console.log(`   Before: ${user.phone}`);
          console.log(`   After:  ${fixedPhone}`);

          await User.updateOne({ _id: user._id }, { $set: { phone: fixedPhone } });

          fixedCount++;
        }
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} phone numbers`);
  } catch (error) {
    console.error('❌ Error fixing phone numbers:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the fix
fixPhoneNumbers();
