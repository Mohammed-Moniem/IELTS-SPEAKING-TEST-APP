# 🏗️ Enhancement #5 - Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                     (React Native Screens)                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Social  │  │ Friends  │  │   Chat   │  │Leaderb'd │       │
│  │   Home   │  │   List   │  │  Screen  │  │  Screen  │  ...  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   CUSTOM HOOKS LAYER       │
        │  (State Management)        │
        │                             │
        │  useFriends()               │
        │  useChat()                  │
        │  useLeaderboard()           │
        │  useAchievements()          │
        │  useReferrals()             │
        │  useProfile()               │
        │  useStudyGroups()           │
        │  useSocket()                │
        └──────┬────────────┬─────────┘
               │            │
    ┌──────────▼────┐  ┌───▼────────────┐
    │  API SERVICES │  │  SOCKET.IO     │
    │   (REST)      │  │  (Real-time)   │
    │               │  │                │
    │ friendService │  │ onMessage()    │
    │ chatService   │  │ onTyping()     │
    │ groupService  │  │ onOnline()     │
    │ leaderboard   │  │ achievement    │
    │ achievement   │  │ unlocked()     │
    │ referral      │  │ friend req()   │
    │ coupon        │  │ ...            │
    │ profile       │  │                │
    └───────┬───────┘  └───┬────────────┘
            │              │
            └──────┬───────┘
                   │
        ┌──────────▼───────────┐
        │   NETWORK LAYER      │
        │                      │
        │  HTTP (Axios)        │
        │  WebSocket (io)      │
        │  JWT Auth            │
        │  AsyncStorage        │
        └──────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │   BACKEND APIs       │
        │  (Express + TypeORM) │
        │                      │
        │  /api/friends/*      │
        │  /api/chat/*         │
        │  /api/groups/*       │
        │  /api/leaderboard/*  │
        │  /api/achievements/* │
        │  /api/referrals/*    │
        │  /api/coupons/*      │
        │  /api/profile/*      │
        └──────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │   DATABASE           │
        │   (PostgreSQL)       │
        │                      │
        │  Users, Friends,     │
        │  Messages, Groups,   │
        │  Achievements, etc.  │
        └──────────────────────┘
```

---

## 📊 Data Flow Example: Sending a Message

```
1. USER ACTION
   │
   ├─> User types message in ChatScreen
   │   └─> Presses send button
   │
2. HOOK LAYER
   │
   ├─> useChat().sendMessage(text, recipientId)
   │   ├─> Sets loading state
   │   ├─> Adds optimistic message to local state
   │   │
3. SERVICE LAYER
   │
   ├─> chatService.sendMessage({ text, recipientId })
   │   ├─> Gets JWT token from AsyncStorage
   │   ├─> Makes POST to /api/chat/messages
   │   │
4. NETWORK LAYER
   │
   ├─> Axios sends HTTP request
   │   └─> Headers: { Authorization: Bearer <token> }
   │   └─> Body: { text, recipientId }
   │   │
5. BACKEND
   │
   ├─> ChatController.sendMessage()
   │   ├─> Validates request
   │   ├─> Saves to database
   │   ├─> Emits Socket.io event
   │   └─> Returns message object
   │   │
6. REAL-TIME BROADCAST
   │
   ├─> Socket.io emits "message:receive"
   │   └─> To recipient's connected socket
   │   │
7. RECIPIENT UPDATES
   │
   ├─> useChat() receives socket event
   │   ├─> Adds message to local state
   │   ├─> Updates unread count
   │   ├─> Triggers re-render
   │   │
8. UI UPDATES
   │
   └─> Both sender and recipient see message
       └─> Typing indicator stops
       └─> Read receipt shows
```

---

## 🔄 State Management Flow

```
┌─────────────────────────────────────────────┐
│  Custom Hook (e.g., useFriends)             │
│                                              │
│  State:                                      │
│  ├─ friends: Friend[]                        │
│  ├─ loading: boolean                         │
│  ├─ error: string | null                     │
│  └─ pendingRequests: FriendRequest[]         │
│                                              │
│  Effects:                                    │
│  ├─ useEffect(() => loadFriends(), [])       │
│  └─ useEffect(() => subscribeToSocket(), []) │
│                                              │
│  Actions:                                    │
│  ├─ sendFriendRequest(userId)                │
│  ├─ acceptRequest(requestId)                 │
│  ├─ removeFriend(friendId)                   │
│  └─ searchUsers(query)                       │
│                                              │
│  Returns:                                    │
│  └─ { friends, loading, error, ...actions } │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  Component (e.g., FriendsListScreen)        │
│                                              │
│  const {                                     │
│    friends,                                  │
│    loading,                                  │
│    sendFriendRequest                         │
│  } = useFriends();                           │
│                                              │
│  return (                                    │
│    <FlatList                                 │
│      data={friends}                          │
│      renderItem={FriendCard}                 │
│    />                                        │
│  );                                          │
└─────────────────────────────────────────────┘
```

---

## 🔌 Socket.io Event System

```
┌──────────────────────────────────────────────┐
│  socketService.ts                             │
│  (Singleton WebSocket Connection)            │
│                                               │
│  connect()                                    │
│  ├─> io(SOCKET_URL, { auth: { token } })     │
│  └─> Sets up reconnection logic              │
│                                               │
│  Event Listeners:                             │
│  ├─ message:receive                           │
│  ├─ typing:start / typing:stop                │
│  ├─ friend:request:receive                    │
│  ├─ friend:request:accepted                   │
│  ├─ achievement:unlocked                      │
│  ├─ user:online / user:offline                │
│  └─ group:invite:receive                      │
│                                               │
│  Event Emitters:                              │
│  ├─ sendMessage(message)                      │
│  ├─ sendTypingIndicator(recipientId)          │
│  └─ updateOnlineStatus(status)                │
└──────────────────────────────────────────────┘
          │
          │ (Used by hooks)
          │
          ▼
┌──────────────────────────────────────────────┐
│  useSocket()                                  │
│  ├─ Manages connection state                 │
│  ├─ Tracks online users                      │
│  └─ Provides helper: isUserOnline(userId)    │
│                                               │
│  useChat()                                    │
│  ├─ Listens to message:receive               │
│  └─ Handles typing indicators                │
│                                               │
│  useFriends()                                 │
│  ├─ Listens to friend:request:receive        │
│  └─ Handles friend:request:accepted          │
│                                               │
│  useAchievements()                            │
│  └─ Listens to achievement:unlocked          │
└──────────────────────────────────────────────┘
```

---

## 📁 File Organization

```
mobile/src/
│
├── config.ts                    # API URLs, feature flags
│
├── services/                    # API wrappers
│   ├── friendService.ts         # → /api/friends/*
│   ├── chatService.ts           # → /api/chat/*
│   ├── groupService.ts          # → /api/groups/*
│   ├── leaderboardService.ts    # → /api/leaderboard/*
│   ├── achievementService.ts    # → /api/achievements/*
│   ├── referralService.ts       # → /api/referrals/*
│   ├── couponService.ts         # → /api/coupons/*
│   ├── profileService.ts        # → /api/profile/*
│   ├── socketService.ts         # WebSocket connection
│   └── index.ts                 # Exports
│
├── hooks/                       # State management
│   ├── useFriends.ts            # Friends logic
│   ├── useChat.ts               # Chat logic
│   ├── useStudyGroups.ts        # Groups logic
│   ├── useLeaderboard.ts        # Leaderboard logic
│   ├── useAchievements.ts       # Achievements logic
│   ├── useProfile.ts            # Profile logic
│   ├── useReferrals.ts          # Referrals logic
│   ├── useSocket.ts             # Socket state
│   └── index.ts                 # Exports
│
├── screens/Social/              # UI screens
│   ├── SocialHomeScreen.tsx     # ✅ Main hub
│   ├── FriendsListScreen.tsx    # ✅ Friends list
│   ├── FriendRequestsScreen.tsx # ⏳ Pending requests
│   ├── FindFriendsScreen.tsx    # ⏳ Search users
│   ├── UserProfileScreen.tsx    # ⏳ View profile
│   ├── ConversationsScreen.tsx  # ✅ Message inbox
│   ├── ChatScreen.tsx           # ✅ Chat interface
│   ├── StudyGroupsScreen.tsx    # ⏳ Group list
│   ├── GroupDetailScreen.tsx    # ⏳ Group info
│   ├── CreateGroupScreen.tsx    # ⏳ Create group
│   ├── GroupChatScreen.tsx      # ⏳ Group messaging
│   ├── LeaderboardScreen.tsx    # ✅ Rankings
│   ├── AchievementsScreen.tsx   # ✅ Achievements
│   ├── AchievementDetailScreen.tsx # ⏳ Single achievement
│   ├── ReferralsScreen.tsx      # ✅ Referral system
│   ├── QRCodeScreen.tsx         # ⏳ Display QR
│   ├── QRCodeScannerScreen.tsx  # ⏳ Scan QR
│   ├── SettingsScreen.tsx       # ⏳ Settings menu
│   ├── PrivacySettingsScreen.tsx # ⏳ Privacy controls
│   └── EditProfileScreen.tsx    # ⏳ Edit profile
│
└── navigation/
    └── SocialNavigator.tsx      # ✅ Stack navigator

✅ = Complete (7 screens)
⏳ = Pending (13 screens)
```

---

## 🎯 Key Patterns Used

### 1. Service Layer Pattern
```typescript
// Separation of concerns
Backend API → Service → Hook → Component

// Example:
export const friendService = {
  async sendFriendRequest(userId: string) {
    const headers = await getAuthHeaders();
    const response = await axios.post('/api/friends/requests', 
      { recipientId: userId }, 
      { headers }
    );
    return response.data;
  }
};
```

### 2. Custom Hooks Pattern
```typescript
// Encapsulate state + logic
export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  
  const loadFriends = useCallback(async () => {
    setLoading(true);
    const data = await friendService.getFriends();
    setFriends(data);
    setLoading(false);
  }, []);
  
  useEffect(() => { loadFriends(); }, []);
  
  return { friends, loading, loadFriends };
}
```

### 3. Real-time Integration
```typescript
// Socket.io event listeners in hooks
useEffect(() => {
  const handleNewMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };
  
  socketService.onMessage(handleNewMessage);
  
  return () => {
    socketService.offMessage(handleNewMessage);
  };
}, []);
```

### 4. TypeScript Types
```typescript
// Shared interfaces
export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  mutualFriends: number;
}

// Type-safe navigation
type SocialStackParamList = {
  Chat: { conversationId: string; recipientName: string };
  UserProfile: { userId: string };
};
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│  PRODUCTION                                      │
│                                                  │
│  ┌──────────────┐       ┌──────────────┐       │
│  │              │       │              │        │
│  │  React Native│◄─────►│  Backend API │        │
│  │  Mobile App  │  HTTP │  (Node.js)   │        │
│  │              │  WSS  │              │        │
│  └──────────────┘       └───────┬──────┘        │
│                                 │                │
│                                 ▼                │
│                         ┌───────────────┐       │
│                         │               │       │
│                         │  PostgreSQL   │       │
│                         │  Database     │       │
│                         │               │       │
│                         └───────────────┘       │
│                                                  │
│  Hosting Options:                               │
│  ├─ Mobile: App Store / Play Store              │
│  ├─ Backend: Heroku, AWS, Azure, DigitalOcean   │
│  └─ Database: Heroku Postgres, AWS RDS          │
└─────────────────────────────────────────────────┘
```

---

## 💡 Performance Optimizations

### 1. Pagination
```typescript
// Load messages in chunks
const { messages, loadMore, hasMore } = useChat();

<FlatList
  data={messages}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
/>
```

### 2. Optimistic Updates
```typescript
// Update UI immediately, sync later
const sendMessage = async (text: string) => {
  const tempMessage = { id: 'temp', text, status: 'sending' };
  setMessages(prev => [...prev, tempMessage]);
  
  const savedMessage = await chatService.sendMessage(text);
  setMessages(prev => 
    prev.map(m => m.id === 'temp' ? savedMessage : m)
  );
};
```

### 3. useCallback
```typescript
// Prevent unnecessary re-renders
const handlePress = useCallback((friendId: string) => {
  navigation.navigate('Chat', { friendId });
}, [navigation]);
```

### 4. Socket Cleanup
```typescript
// Prevent memory leaks
useEffect(() => {
  socketService.onMessage(handler);
  return () => socketService.offMessage(handler);
}, []);
```

---

## 🎨 Design System

### Colors
```typescript
const COLORS = {
  primary: '#007AFF',      // iOS blue
  success: '#34C759',      // Green
  warning: '#FF9500',      // Orange
  error: '#FF3B30',        // Red
  premium: '#5856D6',      // Purple
  background: '#F2F2F7',   // Light gray
  card: '#FFFFFF',         // White
  text: '#000000',         // Black
  secondaryText: '#8E8E93' // Gray
};
```

### Typography
```typescript
const FONTS = {
  regular: 'System',
  bold: 'System-Bold',
  sizes: {
    small: 12,
    body: 17,
    title: 34,
    large: 28
  }
};
```

### Spacing
```typescript
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
};
```

---

**This architecture provides:**
- ✅ Separation of concerns
- ✅ Type safety throughout
- ✅ Real-time capabilities
- ✅ Scalable patterns
- ✅ Easy testing
- ✅ Maintainable code

**Built for production! 🚀**
