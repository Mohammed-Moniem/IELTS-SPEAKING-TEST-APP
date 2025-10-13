# 🚀 Social Features Integration Guide

**Ready to integrate the social features into your IELTS app!**

This guide walks you through the final steps to make everything work together.

---

## ⚡ Quick Installation (5 minutes)

### Step 1: Install Missing Dependencies

```bash
cd mobile

# Navigation (if not already installed)
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# Clipboard for referral codes
npm install @react-native-clipboard/clipboard

# If using Expo (recommended)
npx expo install @react-navigation/native @react-navigation/stack
npx expo install @react-native-clipboard/clipboard
```

### Step 2: Add Social Tab to Main Navigator

Open your main app navigator file (usually `App.tsx` or `src/navigation/MainNavigator.tsx`) and add:

```typescript
import { SocialNavigator } from './src/navigation/SocialNavigator';

// In your Tab.Navigator or main navigator:
<Tab.Screen 
  name="Social" 
  component={SocialNavigator}
  options={{
    title: 'Social',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="people" size={size} color={color} />
    ),
  }}
/>
```

### Step 3: Initialize Socket.io on App Start

In your main `App.tsx` or root component:

```typescript
import socketService from './src/services/socketService';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Connect socket when app starts
    socketService.connect();
    
    // Disconnect when app closes
    return () => {
      socketService.disconnect();
    };
  }, []);
  
  // ... rest of your app
}
```

### Step 4: Start Backend Server

```bash
cd "micro-service-boilerplate-main 2"
npm start
```

The backend should start on `http://localhost:3000`

---

## 🔧 Configuration

### Update API Base URL (for Production)

Edit `mobile/src/config.ts`:

```typescript
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'  // Development
  : 'https://your-api-domain.com';  // Production
```

### Environment Variables (Optional)

Create `.env` file in mobile directory:

```
API_URL=http://localhost:3000
SOCKET_URL=http://localhost:3000
```

---

## 📱 Testing the Features

### 1. Test Friends System

1. Navigate to Social tab
2. Tap "Find Friends"
3. Search for users
4. Send friend request
5. Accept/decline requests
6. View friends list
7. Start a chat with a friend

### 2. Test Chat

1. Go to Conversations
2. Select a friend to chat
3. Send messages (real-time!)
4. See typing indicators
5. Check read receipts
6. Test message editing/deletion

### 3. Test Leaderboard

1. Navigate to Leaderboard
2. Switch between periods (all-time/weekly/monthly/daily)
3. Check your position
4. View friends leaderboard
5. Test opt-in/opt-out

### 4. Test Achievements

1. Go to Achievements
2. Filter by category
3. Check progress bars
4. Complete a practice session (should unlock achievements!)
5. Watch for real-time unlock notifications

### 5. Test Referrals

1. Navigate to Referrals
2. Copy your referral code
3. Share referral link
4. Check daily limit counter
5. View referral history

---

## 🐛 Troubleshooting

### Socket Connection Issues

**Problem:** Socket not connecting

**Solution:**
```typescript
// Check console for connection errors
// Verify backend is running on correct port
// Check API_BASE_URL in config.ts
// Ensure JWT token is stored in AsyncStorage
```

### Navigation Errors

**Problem:** "Cannot navigate to X"

**Solution:**
```typescript
// Uncomment the screen in SocialNavigator.tsx
// Import the screen component
// Add to Stack.Screen list
```

### Type Errors

**Problem:** TypeScript errors in hooks

**Solution:**
```typescript
// Update socketService.ts Message type to match ChatMessage
// Add missing properties: deliveredTo, isDeleted, updatedAt
```

### Missing Clipboard Module

**Problem:** Cannot find '@react-native-clipboard/clipboard'

**Solution:**
```bash
npm install @react-native-clipboard/clipboard
# or
npx expo install @react-native-clipboard/clipboard
```

---

## 🎨 Customization

### Change Colors

Edit inline styles in each screen:

```typescript
// Primary color: #007AFF (blue)
// Success: #34C759 (green)
// Warning: #FF9500 (orange)
// Error: #FF3B30 (red)
// Premium: #5856D6 (purple)
```

### Modify Limits

Edit `mobile/src/config.ts`:

```typescript
export const APP_CONFIG = {
  MAX_FRIEND_REQUESTS_PER_DAY: 20,  // Change as needed
  MAX_FRIENDS: 500,
  MAX_GROUP_MEMBERS: 15,
  MAX_REFERRALS_PER_DAY: 5,
  MESSAGE_LOAD_LIMIT: 50,
};
```

### Add Custom Achievements

Edit `micro-service-boilerplate-main 2/src/api/services/AchievementService.ts`:

```typescript
{
  key: 'my_achievement',
  name: 'My Custom Achievement',
  description: 'Complete my custom task',
  category: 'MILESTONE',
  icon: '🎯',
  points: 50,
  requirement: { type: 'custom', value: 10 },
  isPremium: false,
}
```

---

## 📊 Backend API Endpoints

All endpoints are documented in `BACKEND-COMPLETE.md`.

**Quick Reference:**

- Friends: `/api/friends/*`
- Chat: `/api/chat/*`
- Groups: `/api/groups/*`
- Leaderboard: `/api/leaderboard/*`
- Achievements: `/api/achievements/*`
- Referrals: `/api/referrals/*`
- Profile: `/api/profile/*`
- Coupons: `/api/coupons/*`

---

## 🚀 Adding Remaining Screens

Follow this pattern for each remaining screen:

### 1. Create Screen File

```typescript
// mobile/src/screens/Social/MyNewScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useYourHook } from '../../hooks';

export const MyNewScreen: React.FC = () => {
  const { data, loading, loadData } = useYourHook();
  
  useEffect(() => {
    loadData();
  }, []);
  
  return (
    <View style={styles.container}>
      <Text>Your content here</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});
```

### 2. Add to Navigator

```typescript
// mobile/src/navigation/SocialNavigator.tsx
import { MyNewScreen } from '../screens/Social/MyNewScreen';

// Add to Stack.Navigator:
<Stack.Screen
  name="MyNewScreen"
  component={MyNewScreen}
  options={{ title: 'My Screen' }}
/>
```

### 3. Navigate to It

```typescript
navigation.navigate('MyNewScreen');
```

---

## ✅ Pre-Launch Checklist

Before deploying:

- [ ] All dependencies installed
- [ ] Backend running and accessible
- [ ] Socket.io connects successfully
- [ ] Friends system works end-to-end
- [ ] Chat messages send/receive
- [ ] Leaderboard displays data
- [ ] Achievements unlock correctly
- [ ] Referrals generate codes
- [ ] Navigation flows work
- [ ] Error handling tested
- [ ] Loading states work
- [ ] Empty states display
- [ ] Real-time events trigger
- [ ] Privacy settings respected
- [ ] QR codes generate (if implemented)

---

## 📚 Additional Resources

- **Backend Docs:** `BACKEND-COMPLETE.md`
- **Progress Tracker:** `FRONTEND-PROGRESS.md`
- **Status Report:** `ENHANCEMENT-5-STATUS.md`
- **API Tests:** `API-Testing-Guide.md`
- **Postman Collection:** `IELTS-Practice-API.postman_collection.json`

---

## 🎉 You're Ready!

Your app now has:
- ✅ Real-time chat with encryption
- ✅ Friend system with suggestions
- ✅ Competitive leaderboards
- ✅ Gamified achievements
- ✅ Referral rewards program
- ✅ Study groups (when remaining screens added)
- ✅ User profiles with privacy
- ✅ And much more!

**Time to test and launch! 🚀**

---

## 💡 Need Help?

1. Check error logs in console
2. Review API responses in network tab
3. Test backend endpoints with Postman
4. Verify Socket.io connection in browser devtools
5. Check AsyncStorage for auth token

**Happy coding! 🎊**
