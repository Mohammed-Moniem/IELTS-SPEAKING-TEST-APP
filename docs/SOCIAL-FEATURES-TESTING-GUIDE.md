# Social Features Testing Guide

## Prerequisites

1. **Backend running** on port 4000
2. **ngrok tunnel active** (if testing on mobile device)
3. **User logged in** with valid JWT token
4. **Mobile app connected** to backend

## Quick Test Checklist

### 1. Authentication ✓

- [x] Backend fix applied (`currentUserChecker` added)
- [ ] User can log in successfully
- [ ] JWT token is valid and not malformed
- [ ] Social tab loads without errors
- [ ] Profile data displays correctly

### 2. Friends System

**Test Steps:**

1. Navigate to Social tab → Find Friends
2. Search for users
3. Send friend request
4. Accept/decline requests
5. View friends list
6. Remove a friend
7. Block/unblock user

**Expected Results:**

- Friend requests appear in notifications
- Friends list updates in real-time
- Blocked users don't appear in searches
- Friend count updates on Social home

### 3. Messaging

**Test Steps:**

1. Navigate to Messages
2. Start a conversation with a friend
3. Send text messages
4. Check read receipts
5. Test typing indicators
6. Receive notifications

**Expected Results:**

- Messages appear instantly (Socket.io)
- Unread count badge updates
- Typing indicator shows when friend is typing
- Push notifications work

### 4. Leaderboard

**Test Steps:**

1. Open Leaderboard screen
2. View global rankings
3. Switch to weekly leaderboard
4. View friends-only leaderboard
5. Check own ranking

**Expected Results:**

- Rankings load and display correctly
- User's position is highlighted
- Scores and XP match user's actual data
- Tab switching works smoothly

### 5. Achievements

**Test Steps:**

1. Open Achievements screen
2. View unlocked achievements
3. Check locked achievements
4. Complete an action that unlocks achievement
5. Verify achievement notification

**Expected Results:**

- Achievements categorized properly
- Progress bars accurate
- Notification appears on unlock
- XP reward applied

### 6. Referrals

**Test Steps:**

1. Open Referrals screen
2. View referral code
3. Generate QR code
4. Share referral link
5. Track referral stats

**Expected Results:**

- Unique referral code displayed
- QR code scannable
- Referral count accurate
- Rewards tracked properly

### 7. Study Groups

**Test Steps:**

1. Navigate to Study Groups
2. Create a new group
3. Invite friends
4. Join existing group
5. Send group message
6. Leave group

**Expected Results:**

- Group creation succeeds
- Members can chat
- Group notifications work
- Admin controls functional

## Common Issues & Solutions

### Issue 1: "Cannot use @CurrentUser decorator"

**Solution:** Already fixed in `expressLoader.ts`

### Issue 2: "jwt malformed"

**Solution:** Ensure user is logged in with valid credentials. Check token expiration.

### Issue 3: "Failed to authenticate request"

**Solution:**

- Check Authorization header is sent: `Bearer <token>`
- Verify token hasn't expired
- Re-login if necessary

### Issue 4: Socket.io not connecting

**Solution:**

- Check backend logs for Socket.io initialization
- Verify user is authenticated before socket connection
- Check CORS settings

### Issue 5: Social tab showing empty states

**Solution:**

- Check API calls in network logs
- Verify backend endpoints are responding
- Check for 401/500 errors in console

## API Endpoints Reference

### Friends

- `GET /friends` - Get friends list
- `POST /friends/request` - Send friend request
- `GET /friends/requests` - Get pending requests
- `PUT /friends/requests/:id/accept` - Accept request
- `PUT /friends/requests/:id/decline` - Decline request
- `DELETE /friends/:id` - Remove friend
- `POST /friends/block/:id` - Block user

### Messages

- `GET /chat/conversations` - Get conversations
- `GET /chat/conversations/:id/messages` - Get messages
- `POST /chat/conversations/:id/messages` - Send message
- `PUT /chat/messages/:id/read` - Mark as read
- `GET /chat/unread` - Get unread count

### Leaderboard

- `GET /leaderboard/global` - Global leaderboard
- `GET /leaderboard/weekly` - Weekly leaderboard
- `GET /leaderboard/friends` - Friends leaderboard

### Achievements

- `GET /achievements` - Get all achievements
- `GET /achievements/me` - Get user's achievements
- `POST /achievements/:id/unlock` - Unlock achievement

### Referrals

- `GET /referrals/code` - Get referral code
- `POST /referrals/track` - Track referral use
- `GET /referrals/stats` - Get referral stats

### Profile

- `GET /profile/me` - Get own profile
- `GET /profile/:id` - Get user profile
- `PUT /profile` - Update profile
- `GET /profile/qr` - Get QR code

## Development Tools

### Enable Debug Logging

Set in mobile app:

```typescript
__DEV__ && console.log("API Request:", request);
```

### Check Backend Logs

```bash
# Watch backend logs
cd micro-service-boilerplate-main
npm run serve
```

### Test API Directly

```bash
# Test friends endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "x-api-key: local-dev-api-key" \
     http://localhost:4000/api/v1/friends
```

### Monitor ngrok Traffic

Open in browser: `http://127.0.0.1:4040`

## Success Criteria

✅ All social features load without errors
✅ No "CurrentUserCheckerNotDefinedError" in logs
✅ No "jwt malformed" errors
✅ Real-time features work (Socket.io connected)
✅ All CRUD operations successful
✅ Navigation between screens smooth
✅ Data persists correctly
✅ Notifications appear as expected

## Next Steps After Testing

1. Fix any bugs discovered
2. Optimize performance (lazy loading, caching)
3. Add analytics tracking
4. Implement push notification scheduling
5. Add social onboarding flow
6. Create user tutorials/tooltips
