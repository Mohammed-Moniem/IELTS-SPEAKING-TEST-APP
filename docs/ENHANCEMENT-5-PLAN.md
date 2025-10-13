# 🎯 Enhancement #5: Social Features & Gamification

## Full Implementation Plan

**Status**: In Progress  
**Started**: October 10, 2025  
**Estimated Time**: 29-36 hours (3-4 days)

---

## 📋 Implementation Specifications

### **Confirmed Requirements**

#### 1. **Chat & Real-time Features**

- ✅ Socket.io for real-time communication
- ✅ AES-256-CBC encryption for all messages and PII
- ✅ Max 15 members per study group
- ✅ Message persistence in MongoDB
- ✅ 1-on-1 chat
- ✅ Group chat for study groups
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Online/offline status

#### 2. **Referral System**

- ✅ Unique referral codes per user (format: XXX-XXX-XXX)
- ✅ Rewards granted immediately upon friend registration
- ✅ 1 referral = 1 extra practice session
- ✅ 2+ referrals = 1 extra practice per referral + 1 simulation test
- ✅ Max 5 referrals per day limit
- ✅ Referral tracking and statistics

#### 3. **Coupon/Promo System**

- ✅ All types: Percentage, Fixed amount, Trial extensions, Free sessions
- ✅ Expiration dates
- ✅ On/off toggle for activation
- ✅ Usage limits (total and per-user)
- ✅ Influencer codes with commission tracking
- ✅ Minimum purchase requirements
- ✅ Subscription tier restrictions

#### 4. **Friend System**

- ✅ Friend requests (send/accept/decline/block)
- ✅ Friend discovery via:
  - Username/email search
  - QR code scanning
- ✅ Smart friend suggestions based on:
  - IELTS type (Academic/General)
  - Target country
  - Target university
  - Study purpose
  - Skill level

#### 5. **Study Groups**

- ✅ Create/join/leave groups
- ✅ Group admin system
- ✅ Group invitations
- ✅ Max 15 members
- ✅ Premium-only feature
- ✅ Group metadata for better matching

#### 6. **Leaderboards**

- ✅ Daily/Weekly/All-time rankings
- ✅ Multiple sorting options:
  - Average score
  - Total sessions
  - Achievement points
  - Current streak
- ✅ Opt-in by default (must enable)
- ✅ Filtered by visibility settings

#### 7. **Achievement System**

- ✅ 25+ predefined achievements
- ✅ Categories: Practice, Improvement, Streak, Social, Milestone
- ✅ Progress tracking
- ✅ Points and badges
- ✅ Premium-exclusive achievements

#### 8. **Privacy & Settings**

- ✅ Profile visibility (Public/Private/Friends-only)
- ✅ Leaderboard opt-in (default: opt-in, must enable)
- ✅ Private profile = hidden from all social features
- ✅ Granular privacy controls:
  - Show statistics
  - Show activity
  - Show study goals
  - Allow friend suggestions
  - Allow direct messages

#### 9. **Premium Feature Gating**

- ✅ Show teasers for free users
- ✅ "Upgrade to Premium" prompts
- ✅ Feature locks on:
  - Study groups
  - Unlimited chat
  - Premium achievements
  - Advanced friend suggestions

---

## 🗂️ Implementation Progress

### **Phase 1: Backend Foundation** ✅ COMPLETE

**Time**: ~4 hours

#### Dependencies Installed ✅

- `socket.io` - Real-time communication
- `crypto-js` - Encryption utilities
- `bcryptjs` - Password hashing
- `@types/crypto-js`, `@types/bcryptjs` - TypeScript types

#### Database Models Created ✅

1. **FriendModel.ts** (97 lines) ✅

   - FriendRequest model
   - Friendship model
   - Indexes for efficient queries

2. **ChatMessageModel.ts** (179 lines) ✅

   - ChatMessage model with encryption fields
   - Conversation model for metadata
   - Read/delivered tracking

3. **StudyGroupModel.ts** (181 lines) ✅

   - StudyGroup model
   - StudyGroupInvite model
   - Group settings and metadata

4. **ReferralModel.ts** (167 lines) ✅

   - Referral tracking
   - UserReferralStats model
   - Daily referral limits

5. **CouponModel.ts** (225 lines) ✅

   - Coupon model with all types
   - CouponUsage tracking
   - Influencer commission support

6. **AchievementModel.ts** (275 lines) ✅

   - Achievement definitions
   - UserAchievement progress tracking
   - UserStats model for leaderboard

7. **UserProfileModel.ts** (180 lines) ✅
   - Extended user profile
   - IELTS info for suggestions
   - Study goals and social settings
   - Privacy controls

#### Services Created ✅

1. **EncryptionService.ts** (209 lines) ✅
   - AES-256-CBC encryption/decryption
   - PII data protection
   - Message encryption
   - Referral code generation
   - Secure token generation

#### Socket.io Setup ✅

1. **SocketIOLoader.ts** (310 lines) ✅

   - JWT authentication middleware
   - Connection management
   - Direct messaging (1-on-1)
   - Group messaging
   - Typing indicators
   - Read receipts
   - Online/offline status tracking
   - Friend request notifications

2. **expressLoader.ts** - Modified ✅
   - Integrated HTTP server creation
   - Socket.io initialization

---

### **Phase 2: Backend APIs** 🚧 IN PROGRESS

**Estimated Time**: ~8-10 hours

#### Controllers to Create

##### 1. **FriendController.ts**

- `POST /friends/request` - Send friend request
- `GET /friends/requests` - List pending requests
- `POST /friends/accept/:requestId` - Accept request
- `POST /friends/decline/:requestId` - Decline request
- `DELETE /friends/:friendId` - Remove friend
- `GET /friends` - List all friends
- `GET /friends/search` - Search users by username/email
- `GET /friends/suggestions` - Get smart friend suggestions
- `POST /friends/block/:userId` - Block user
- `GET /friends/blocked` - List blocked users

##### 2. **ChatController.ts**

- `GET /chat/conversations` - List user's conversations
- `GET /chat/messages/:conversationId` - Get conversation history
- `POST /chat/messages/:messageId/read` - Mark message as read
- `DELETE /chat/messages/:messageId` - Delete message
- `PUT /chat/messages/:messageId` - Edit message

##### 3. **StudyGroupController.ts**

- `POST /groups` - Create study group
- `GET /groups` - List user's groups
- `GET /groups/:groupId` - Get group details
- `PUT /groups/:groupId` - Update group settings
- `DELETE /groups/:groupId` - Delete group
- `POST /groups/:groupId/members` - Invite member
- `DELETE /groups/:groupId/members/:userId` - Remove member
- `POST /groups/:groupId/join` - Join group
- `POST /groups/:groupId/leave` - Leave group
- `GET /groups/:groupId/members` - List group members
- `POST /groups/:groupId/admins/:userId` - Promote to admin
- `DELETE /groups/:groupId/admins/:userId` - Remove admin

##### 4. **ReferralController.ts**

- `GET /referrals/code` - Get user's referral code
- `GET /referrals/stats` - Get referral statistics
- `POST /referrals/redeem/:code` - Redeem referral code
- `GET /referrals/history` - Get referral history

##### 5. **CouponController.ts**

- `POST /coupons/validate` - Validate coupon code
- `POST /coupons/apply` - Apply coupon to purchase
- `GET /coupons/history` - Get user's coupon usage history

##### 6. **LeaderboardController.ts**

- `GET /leaderboard/daily` - Get daily leaderboard
- `GET /leaderboard/weekly` - Get weekly leaderboard
- `GET /leaderboard/all-time` - Get all-time leaderboard
- `GET /leaderboard/friends` - Get friends leaderboard
- `POST /leaderboard/opt-in` - Opt-in to leaderboard
- `POST /leaderboard/opt-out` - Opt-out from leaderboard

##### 7. **AchievementController.ts**

- `GET /achievements` - List all achievements
- `GET /achievements/user/:userId` - Get user's achievements
- `GET /achievements/progress` - Get achievement progress
- `POST /achievements/:achievementId/claim` - Claim achievement reward

##### 8. **UserProfileController.ts**

- `GET /profile/:userId` - Get user profile
- `PUT /profile` - Update own profile
- `PUT /profile/settings` - Update privacy settings
- `POST /profile/qr-code` - Generate QR code
- `GET /profile/stats/:userId` - Get user statistics

#### Services to Create

##### 1. **FriendService.ts**

- Friend request logic
- Friend suggestion algorithm
- Mutual friend detection

##### 2. **ChatService.ts**

- Message encryption/decryption
- Conversation management
- Message history pagination

##### 3. **StudyGroupService.ts**

- Group creation and management
- Member management
- Permission checking

##### 4. **ReferralService.ts**

- Referral code generation
- Reward calculation and granting
- Daily limit enforcement

##### 5. **CouponService.ts**

- Coupon validation
- Discount calculation
- Usage tracking
- Commission calculation

##### 6. **LeaderboardService.ts**

- Ranking calculation
- Score aggregation
- Periodic updates (cron jobs)

##### 7. **AchievementService.ts**

- Achievement checking
- Progress tracking
- Automatic unlocking

##### 8. **UserStatsService.ts**

- Statistics calculation
- Weekly/monthly reset
- Streak tracking

---

### **Phase 3: Frontend Mobile** 📱 PENDING

**Estimated Time**: ~15-18 hours

#### Dependencies to Install

```bash
cd mobile
npm install socket.io-client qrcode qrcode-scanner react-native-qrcode-svg \
  react-native-share crypto-js @react-native-community/netinfo
```

#### Screens to Create

##### 1. **Social Tab** (Main Hub)

- Friends list
- Pending friend requests
- Study groups
- Quick access to chat

##### 2. **Friends Screens**

- `FriendsListScreen.tsx` - List all friends
- `FriendRequestsScreen.tsx` - Pending requests
- `FriendSearchScreen.tsx` - Search/discover
- `FriendSuggestionsScreen.tsx` - Smart suggestions
- `FriendProfileScreen.tsx` - View friend's profile
- `QRCodeScannerScreen.tsx` - Scan QR to add friends
- `QRCodeDisplayScreen.tsx` - Show own QR code

##### 3. **Chat Screens**

- `ConversationsListScreen.tsx` - All conversations
- `ChatScreen.tsx` - 1-on-1 chat
- `GroupChatScreen.tsx` - Group chat
- Components:
  - `MessageBubble.tsx` - Single message
  - `TypingIndicator.tsx` - Typing animation
  - `MessageInput.tsx` - Send message input

##### 4. **Study Group Screens**

- `StudyGroupsListScreen.tsx` - User's groups
- `StudyGroupDetailsScreen.tsx` - Group info/chat
- `CreateStudyGroupScreen.tsx` - Create new group
- `StudyGroupSettingsScreen.tsx` - Edit group
- `StudyGroupMembersScreen.tsx` - Member management

##### 5. **Leaderboard Screens**

- `LeaderboardScreen.tsx` - Main leaderboard (tabs)
  - Daily tab
  - Weekly tab
  - All-time tab
  - Friends tab
- `LeaderboardProfileScreen.tsx` - View ranked user

##### 6. **Achievement Screens**

- `AchievementsScreen.tsx` - All achievements
- `AchievementDetailsScreen.tsx` - Single achievement
- `AchievementUnlockedModal.tsx` - Unlock animation

##### 7. **Referral Screen**

- `ReferralScreen.tsx` - Share code, track referrals

##### 8. **Profile Screens**

- `EditProfileScreen.tsx` - Edit profile info
- `PrivacySettingsScreen.tsx` - Privacy controls
- `ProfileCustomizationScreen.tsx` - Avatar/bio

#### Components to Create

##### 1. **Social Components**

- `FriendRequestCard.tsx` - Request item
- `FriendListItem.tsx` - Friend item
- `OnlineStatusBadge.tsx` - Online indicator
- `ChatPreviewCard.tsx` - Conversation preview

##### 2. **Group Components**

- `StudyGroupCard.tsx` - Group item
- `GroupMemberItem.tsx` - Member in list
- `GroupInviteCard.tsx` - Invite item

##### 3. **Leaderboard Components**

- `LeaderboardRow.tsx` - Ranked user row
- `RankBadge.tsx` - Rank indicator
- `ScoreChart.tsx` - Performance graph

##### 4. **Achievement Components**

- `AchievementCard.tsx` - Achievement item
- `AchievementBadge.tsx` - Badge icon
- `ProgressBar.tsx` - Achievement progress

##### 5. **Referral Components**

- `ReferralCodeCard.tsx` - Share code card
- `ReferralStatsCard.tsx` - Statistics display
- `ReferralHistoryItem.tsx` - Referral item

##### 6. **Premium Gates**

- `PremiumFeatureLock.tsx` - Lock overlay
- `UpgradeToPremiumModal.tsx` - Upgrade prompt

#### Services/Hooks to Create

##### 1. **Socket.io Integration**

- `socketService.ts` - Socket.io client wrapper
  - Connection management
  - Event handlers
  - Auto-reconnection
  - Message encryption/decryption

##### 2. **API Services**

- `friendApi.ts` - Friend API calls
- `chatApi.ts` - Chat API calls
- `groupApi.ts` - Group API calls
- `referralApi.ts` - Referral API calls
- `couponApi.ts` - Coupon API calls
- `leaderboardApi.ts` - Leaderboard API calls
- `achievementApi.ts` - Achievement API calls

##### 3. **React Query Hooks**

- `useFriends.ts`
- `useConversations.ts`
- `useStudyGroups.ts`
- `useLeaderboard.ts`
- `useAchievements.ts`
- `useReferralStats.ts`

##### 4. **Custom Hooks**

- `useSocket.ts` - Socket.io hook
- `useOnlineStatus.ts` - Online status tracking
- `useTypingIndicator.ts` - Typing indicator
- `useEncryption.ts` - Message encryption
- `useQRCodeScanner.ts` - QR scanner logic

#### Navigation Updates

- Add Social tab to bottom tabs
- Create SocialStackNavigator
- Integrate chat screens
- Add deep linking support

---

### **Phase 4: Testing & Documentation** 📝 PENDING

**Estimated Time**: ~2-3 hours

#### Backend Testing

- Unit tests for services
- Integration tests for APIs
- Socket.io event testing
- Encryption/decryption tests

#### Frontend Testing

- Component tests
- Socket.io connection tests
- API integration tests
- E2E tests for critical flows

#### Documentation

- API documentation (Postman/Swagger)
- Socket.io event reference
- Encryption guide
- Testing guide
- Admin guide for coupons/influencers

---

## 📊 File Count Summary

### Backend (Phase 1 & 2)

- **Models**: 7 files (~1,350 lines)
- **Services**: 9 files (~1,500 lines estimated)
- **Controllers**: 8 files (~1,200 lines estimated)
- **Loaders**: 2 files modified (~350 lines)
- **Total Backend**: ~26 files, ~4,400 lines

### Frontend (Phase 3)

- **Screens**: ~20 files (~4,000 lines estimated)
- **Components**: ~20 files (~2,000 lines estimated)
- **Services**: ~15 files (~1,500 lines estimated)
- **Navigation**: 2 files modified (~200 lines)
- **Total Frontend**: ~57 files, ~7,700 lines

### Documentation (Phase 4)

- **Docs**: ~5 files (~1,000 lines)

### **Grand Total**: ~88 files, ~13,100 lines of code

---

## 🎯 Key Features Summary

### Chat System

- ✅ End-to-end encrypted messages
- ✅ 1-on-1 and group chat
- ✅ Real-time delivery with Socket.io
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Message history
- ✅ Online/offline status

### Friend System

- ✅ Send/accept/decline requests
- ✅ Search by username/email
- ✅ QR code scanning
- ✅ Smart suggestions based on profile
- ✅ Block users
- ✅ View friend profiles

### Study Groups

- ✅ Create and manage groups
- ✅ Max 15 members
- ✅ Admin system
- ✅ Group chat
- ✅ Invitations
- ✅ Premium-only

### Referral System

- ✅ Unique codes per user
- ✅ Immediate rewards
- ✅ 1 referral = 1 practice
- ✅ 2+ referrals = practices + simulation
- ✅ Max 5/day limit
- ✅ Statistics tracking

### Coupon System

- ✅ All discount types
- ✅ Expiration dates
- ✅ Usage limits
- ✅ Influencer codes
- ✅ Commission tracking
- ✅ Validation rules

### Leaderboards

- ✅ Daily/Weekly/All-time
- ✅ Multiple sorting options
- ✅ Opt-in system
- ✅ Friends-only view
- ✅ Privacy controls

### Achievements

- ✅ 25+ achievements
- ✅ 5 categories
- ✅ Progress tracking
- ✅ Points and badges
- ✅ Auto-unlocking

### Privacy

- ✅ 3 visibility levels
- ✅ Granular controls
- ✅ Leaderboard opt-in
- ✅ Profile hiding
- ✅ Activity privacy

---

## 🔐 Security Measures

1. **Encryption**

   - AES-256-CBC for messages
   - Unique IV per message
   - Encrypted PII data
   - Secure key storage

2. **Authentication**

   - JWT authentication for Socket.io
   - Token validation on every connection
   - Automatic disconnection on invalid tokens

3. **Privacy**

   - Opt-in leaderboards
   - Granular visibility controls
   - Private profiles completely hidden
   - Friend-only options

4. **Rate Limiting**

   - Friend request limits
   - Message rate limits
   - Daily referral limits (5/day)
   - Search query limits

5. **Data Protection**
   - GDPR compliance
   - Data encryption at rest
   - Secure token generation
   - Password hashing (bcrypt)

---

## ⏱️ Implementation Timeline

| Phase | Task                      | Hours | Status      |
| ----- | ------------------------- | ----- | ----------- |
| 1     | Install dependencies      | 0.5h  | ✅ Complete |
| 1     | Create database models    | 3h    | ✅ Complete |
| 1     | Create encryption service | 1h    | ✅ Complete |
| 1     | Setup Socket.io           | 1.5h  | ✅ Complete |
| 2     | Friend APIs               | 2h    | 🚧 Next     |
| 2     | Chat APIs                 | 1.5h  | ⏳ Pending  |
| 2     | Group APIs                | 2h    | ⏳ Pending  |
| 2     | Referral APIs             | 1.5h  | ⏳ Pending  |
| 2     | Coupon APIs               | 1.5h  | ⏳ Pending  |
| 2     | Leaderboard APIs          | 2h    | ⏳ Pending  |
| 2     | Achievement APIs          | 1.5h  | ⏳ Pending  |
| 2     | Profile APIs              | 1h    | ⏳ Pending  |
| 3     | Socket.io client          | 2h    | ⏳ Pending  |
| 3     | Friend screens            | 3h    | ⏳ Pending  |
| 3     | Chat screens              | 4h    | ⏳ Pending  |
| 3     | Group screens             | 3h    | ⏳ Pending  |
| 3     | Leaderboard screens       | 2h    | ⏳ Pending  |
| 3     | Achievement screens       | 2h    | ⏳ Pending  |
| 3     | Referral screen           | 1h    | ⏳ Pending  |
| 3     | Profile screens           | 2h    | ⏳ Pending  |
| 3     | Navigation                | 1h    | ⏳ Pending  |
| 4     | Testing                   | 2h    | ⏳ Pending  |
| 4     | Documentation             | 1h    | ⏳ Pending  |

**Total**: 36 hours (4.5 days at 8h/day)

---

## 🚀 Next Steps

1. **Create Friend APIs** (Starting now)
2. Create remaining backend controllers
3. Create backend services
4. Test backend with Postman
5. Install mobile dependencies
6. Create Socket.io client service
7. Create friend screens
8. Create chat screens
9. Create remaining screens
10. Integration testing
11. Documentation

---

## 📝 Notes

- All PII data encrypted with AES-256-CBC
- Messages encrypted end-to-end
- Socket.io with JWT authentication
- Premium features properly gated
- Referral rewards granted immediately
- Max 5 referrals per day
- Study groups limited to 15 members
- Leaderboard opt-in by default
- Private profiles completely hidden

---

**Last Updated**: October 10, 2025  
**Current Phase**: Phase 2 - Backend APIs  
**Progress**: 15% Complete (Phase 1 done, starting Phase 2)
