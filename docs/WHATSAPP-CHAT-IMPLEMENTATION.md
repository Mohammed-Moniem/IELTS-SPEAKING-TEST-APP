# WhatsApp-Like Chat Implementation - Complete Guide

## Overview

This document outlines the comprehensive implementation of a WhatsApp-like chat experience with voice notes, images, videos, GIFs, typing indicators, online status, and encrypted messages.

## Backend Changes Completed

### 1. Environment Configuration (`env.ts`)

**Changes:**

- Added `chatFilesCollectionName` for MongoDB GridFS storage
- Added `chatFilesBucket` for AWS S3 storage
- Expanded `allowedMimeTypes` to include images, videos, GIFs
- Added `chatFileTTLDays` (default: 30 days) for automatic file cleanup

**Configuration:**

```typescript
storage: {
  provider: 'mongodb', // or 's3' via STORAGE_PROVIDER env variable
  mongodb: {
    chatFilesCollectionName: 'chat_files'
  },
  s3: {
    chatFilesBucket: 'ielts-chat-files'
  },
  chatFileTTLDays: 30 // Auto-delete after 1 month
}
```

### 2. File Storage Service (`FileStorageService.ts`)

**Created:** Complete file storage service with MongoDB GridFS and AWS S3 support

**Features:**

- ✅ Configurable storage backend (MongoDB/S3) via `STORAGE_PROVIDER` env variable
- ✅ Automatic file cleanup after 30 days (TTL index)
- ✅ File size validation (max 50MB configurable)
- ✅ MIME type validation
- ✅ Support for images, videos, audio, GIFs
- ✅ Metadata tracking (duration, dimensions, waveform data)
- ✅ Thumbnail generation support (placeholder for sharp/ffmpeg)
- ✅ GridFS streaming for large files
- ✅ S3 signed URLs with expiry

**API:**

```typescript
uploadFile(buffer, fileName, mimeType, metadata): Promise<UploadedFile>
downloadFromGridFS(fileId): Promise<{stream, metadata}>
deleteFile(fileId): Promise<void>
generateThumbnail(buffer, mimeType): Promise<Buffer>
```

### 3. Enhanced Message Model (`ChatMessageModel.ts`)

**Changes:**

- Added message types: `'video' | 'gif'` (in addition to existing text, image, audio, file)
- Added `reactions` field: Map<emoji, userId[]> for message reactions
- Enhanced `metadata` field with:
  - `thumbnailUrl`: For image/video thumbnails
  - `waveformData`: Array of amplitudes for audio visualization
  - `width/height`: For images and videos
  - `replyToContent`: Preview text of replied message
  - `forwardedFromUserId`: Track forwarded messages
  - `linkPreview`: {url, title, description, imageUrl} for rich link previews

**Schema:**

```typescript
messageType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'gif' | 'system'
reactions: Map<string, ObjectId[]>
metadata: {
  fileName, fileSize, fileUrl, thumbnailUrl,
  duration, waveformData,
  width, height,
  replyToMessageId, replyToContent, forwardedFromUserId,
  linkPreview: { url, title, description, imageUrl }
}
```

### 4. User Status Model (`UserStatusModel.ts`)

**Created:** New model for real-time online status tracking

**Fields:**

- `userId`: Reference to User
- `isOnline`: Boolean flag
- `lastSeen`: Timestamp of last activity
- `socketIds`: Array of active socket connections (multi-device support)
- `currentlyTypingIn`: Array of conversationIds where user is typing

**Indexes:**

- `userId` (unique)
- `isOnline, lastSeen` (compound for online users query)

### 5. Socket.IO Enhancements (`SocketIOLoader.ts`)

**Changes:**

- ✅ Integrated `UserStatus` model for persistent online status
- ✅ On connect: Update database, notify friends
- ✅ On disconnect: Clean up socketIds, mark offline if no more connections, notify friends
- ✅ Typing indicators: Track in database, emit to specific users/groups with conversationId
- ✅ `message:sent` confirmation event already implemented
- ✅ Multi-device support: Track multiple socketIds per user
- ✅ Friend-only notifications: Only notify user's friends about status changes

**Events:**

```typescript
// Outgoing (from server)
'user:online' → { userId, timestamp }
'user:offline' → { userId, lastSeen }
'typing:indicator' → { userId, conversationId, isTyping }
'message:receive' → { encryptedContent, iv, ... }
'message:sent' → { ...message, status: 'delivered' }

// Incoming (from client)
'typing:start' → { conversationId, recipientId?, groupId? }
'typing:stop' → { conversationId, recipientId?, groupId? }
'message:send' → { recipientId, content, messageType, metadata }
```

## Mobile Changes Required

### 1. Fix Current Message Sending Issue

**Problem:** Messages sent via Socket.IO don't appear in chat immediately

**Root Cause:**

- `useChat` hook listens for `message:receive` event but sender doesn't get their own message back
- Need to handle `message:sent` event to add optimistic message to local state
- Or use chatService API to save message and get full response

**Solution Options:**
A) Handle `message:sent` event in socketService and forward to useChat
B) Use chatService.sendMessage() API instead of socket direct emit
C) Add optimistic update before socket emit with temporary ID

### 2. Media Upload Service (`mediaUploadService.ts`)

**Create:** New service for handling all media uploads

**Features:**

- Image picker with compression
- Video picker with compression
- Audio recorder with waveform generation
- GIF selector (Giphy/Tenor integration)
- Chunked uploads for large files
- Progress tracking
- Cancel support

**API:**

```typescript
pickImage(): Promise<{uri, type, size, width, height}>
pickVideo(): Promise<{uri, type, size, duration, width, height}>
recordAudio(): Promise<{uri, type, size, duration, waveform}>
pickGIF(): Promise<{uri, type, size}>
uploadFile(file, metadata, onProgress): Promise<UploadedFile>
```

### 3. Voice Note Recording Component (`VoiceNoteRecorder.tsx`)

**Create:** WhatsApp-style voice note recording

**Features:**

- Press and hold to record
- Slide left to cancel
- Release to send
- Waveform visualization during recording
- Duration display
- Haptic feedback
- Lock recording for long messages

**UI:**

```
[Microphone Icon] Hold to record
→ While holding: [Cancel ← ● Recording 0:05 [Waveform]]
```

### 4. Enhanced ChatScreen (`ChatScreen.tsx`)

**Redesign:** Complete WhatsApp UI overhaul

**Features:**

- Message bubbles with tails
- Sender (blue) vs receiver (white) bubbles
- Image messages with thumbnails and lightbox
- Video messages with play button overlay
- Voice note player with waveform and progress
- GIF support with auto-play
- Link preview cards
- Reply message preview above input
- Forward message UI
- Reactions (long-press → emoji picker)
- Date separators ("Today", "Yesterday", "Dec 19")
- Message status: sending, sent, delivered, read (✓, ✓✓)
- Swipe right to reply gesture

### 5. Online Status & Typing Indicators

**ChatScreen Header:**

```
[← Back]  John Doe              [Call] [Video] [•••]
          online / last seen 5m ago
          typing...
```

**Implementation:**

- Subscribe to `user:online`, `user:offline` events for recipient
- Subscribe to `typing:indicator` events for conversation
- Show "typing..." with animation when recipientId matches
- Update header with online/last seen status
- Green dot indicator for online status

### 6. Media Preview & Viewer

**Create:** Full-screen media viewer

**Features:**

- Image zoom/pinch
- Video player with controls
- Share button
- Download button
- Delete button (own messages)
- Swipe to dismiss
- Caption display

## Implementation Roadmap

### Phase 1: Fix Current Issues (IMMEDIATE)

1. ✅ Backend: Environment & storage configuration
2. ✅ Backend: File storage service with GridFS
3. ✅ Backend: Enhanced message model
4. ✅ Backend: User status model
5. ✅ Backend: Socket.IO online status tracking
6. ⏳ Mobile: Fix message sending (add message to local state)
7. ⏳ Mobile: Handle `message:sent` event in useChat

### Phase 2: Media Upload (Day 1-2)

1. Create mediaUploadService
2. Add image picker & compression
3. Add video picker & compression
4. Create audio recorder
5. Add GIF picker integration
6. Implement upload with progress

### Phase 3: Chat UI Redesign (Day 2-3)

1. Redesign message bubbles (WhatsApp style)
2. Add image message rendering
3. Add video message rendering
4. Create voice note player component
5. Add GIF support
6. Add link preview component
7. Add date separators
8. Add message status indicators

### Phase 4: Voice Notes (Day 3-4)

1. Create VoiceNoteRecorder component
2. Implement hold-to-record gesture
3. Add waveform visualization
4. Add slide-to-cancel
5. Integrate audio recording API
6. Add playback controls

### Phase 5: Online Status & Typing (Day 4)

1. Update ChatScreen header with status
2. Subscribe to online/offline events
3. Subscribe to typing events
4. Add typing indicator UI
5. Send typing start/stop on input

### Phase 6: Advanced Features (Day 5+)

1. Message reactions (emoji picker)
2. Reply to message
3. Forward message
4. Message search
5. Media gallery view
6. Voice message playback speed
7. Read receipts UI

## Testing Checklist

### Backend

- [ ] File upload to GridFS works
- [ ] File download from GridFS streams correctly
- [ ] TTL index deletes files after 30 days
- [ ] S3 upload works (when configured)
- [ ] Online status updates on connect/disconnect
- [ ] Typing indicators emit to correct users
- [ ] Multi-device support (multiple socketIds)
- [ ] Friend-only status notifications

### Mobile

- [ ] Messages appear immediately after sending
- [ ] Images upload and display
- [ ] Videos upload and play
- [ ] Voice notes record and playback
- [ ] GIFs load and animate
- [ ] Online status shows correctly
- [ ] Typing indicator appears/disappears
- [ ] Message reactions work
- [ ] Reply to message works
- [ ] Forward message works
- [ ] Read receipts accurate

## Environment Variables

### Backend (.env)

```bash
# Storage Configuration
STORAGE_PROVIDER=mongodb  # or 's3'
STORAGE_MONGODB_CHAT_FILES=chat_files
STORAGE_MAX_FILE_SIZE_MB=50
STORAGE_ALLOWED_MIME_TYPES=audio/mpeg,audio/wav,audio/webm,audio/mp4,image/jpeg,image/png,image/gif,video/mp4,video/quicktime
CHAT_FILE_TTL_DAYS=30

# AWS S3 (if using S3)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_CHAT_FILES_BUCKET=ielts-chat-files
AWS_S3_SIGNED_URL_EXPIRY=3600

# MongoDB
MONGO_URL=mongodb://127.0.0.1:27017/ielts-speaking

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

### Mobile (.env)

```bash
SOCKET_URL=https://your-ngrok-url.ngrok-free.app
API_URL=https://your-ngrok-url.ngrok-free.app/api/v1
```

## File Structure

### Backend

```
src/
├── api/
│   ├── models/
│   │   ├── ChatMessageModel.ts (✅ Enhanced)
│   │   └── UserStatusModel.ts (✅ New)
│   ├── services/
│   │   ├── FileStorageService.ts (✅ New)
│   │   ├── ChatService.ts (Needs enhancement for media)
│   │   └── EncryptionService.ts (Existing)
│   └── controllers/
│       └── ChatController.ts (Needs file upload endpoints)
├── loaders/
│   └── SocketIOLoader.ts (✅ Enhanced)
└── env.ts (✅ Enhanced)
```

### Mobile

```
src/
├── services/
│   ├── api/
│   │   ├── chatService.ts (Needs media upload methods)
│   │   └── mediaUploadService.ts (⏳ New)
│   └── socketService.ts (Needs message:sent handler)
├── hooks/
│   └── useChat.ts (⏳ Fix message sending)
├── components/
│   ├── chat/
│   │   ├── MessageBubble.tsx (⏳ New)
│   │   ├── VoiceNoteRecorder.tsx (⏳ New)
│   │   ├── VoiceNotePlayer.tsx (⏳ New)
│   │   ├── ImageMessage.tsx (⏳ New)
│   │   ├── VideoMessage.tsx (⏳ New)
│   │   ├── LinkPreview.tsx (⏳ New)
│   │   └── TypingIndicator.tsx (⏳ New)
│   └── media/
│       ├── MediaPicker.tsx (⏳ New)
│       ├── MediaViewer.tsx (⏳ New)
│       └── GIFPicker.tsx (⏳ New)
└── screens/
    └── social/
        └── ChatScreen.tsx (⏳ Major redesign)
```

## Dependencies to Install

### Backend

```bash
cd micro-service-boilerplate-main
npm install aws-sdk  # If using S3
# GridFS is part of mongodb package (already installed)
```

### Mobile

```bash
cd mobile
npm install expo-image-picker expo-av expo-file-system
npm install react-native-gifted-chat  # Optional: for chat UI components
npm install react-native-audio-recorder-player  # For voice notes
npm install @react-native-community/slider  # For audio/video progress
npm install react-native-fast-image  # For optimized image loading
npm install react-native-video  # For video playback
```

## API Endpoints to Add

### Chat Controller

```typescript
POST   /api/v1/chat/upload/image
POST   /api/v1/chat/upload/video
POST   /api/v1/chat/upload/audio
POST   /api/v1/chat/upload/file
GET    /api/v1/chat/files/:fileId
DELETE /api/v1/chat/files/:fileId
POST   /api/v1/chat/messages/:messageId/react
POST   /api/v1/chat/messages/:messageId/reply
POST   /api/v1/chat/messages/:messageId/forward
GET    /api/v1/chat/status/:userId
```

## Security Considerations

1. **File Upload:**

   - Validate file size and type
   - Scan for malware (consider ClamAV)
   - Generate unique filenames
   - Rate limit uploads

2. **Message Encryption:**

   - All message content encrypted with AES-256
   - IV stored per message
   - File content can be encrypted (optional for large files)

3. **Access Control:**

   - Verify user can access conversation
   - Check friendship status for 1-on-1 chats
   - Verify group membership for group chats
   - Signed URLs for S3 with expiry

4. **Privacy:**
   - Online status only visible to friends
   - Typing indicators only to conversation participants
   - Read receipts can be disabled (future)
   - Last seen can be hidden (future)

## Performance Optimization

1. **File Storage:**

   - Use S3 for production (better scalability)
   - Implement CDN for media delivery
   - Generate thumbnails for images/videos
   - Compress images before upload

2. **Socket.IO:**

   - Use Redis adapter for horizontal scaling
   - Implement presence channels efficiently
   - Batch status updates

3. **Database:**

   - Index frequently queried fields
   - Use aggregation for conversation lists
   - Implement cursor-based pagination
   - TTL indexes for automatic cleanup

4. **Mobile:**
   - Cache media files locally
   - Lazy load images in chat
   - Virtual list for long conversations
   - Optimize re-renders with React.memo

## Next Steps

1. **Fix Message Sending** (Top Priority)

   - Update useChat to handle message:sent
   - Add optimistic update to local state
   - Handle send failures gracefully

2. **Create Media Upload Service**

   - Image picker integration
   - Video picker integration
   - Audio recorder integration

3. **Redesign ChatScreen UI**

   - WhatsApp-style message bubbles
   - Media message rendering
   - Voice note player

4. **Implement Online Status**

   - Header status display
   - Socket event subscriptions
   - Real-time updates

5. **Add Typing Indicators**
   - Detect input changes
   - Emit typing events
   - Show typing UI

---

**Status:** Backend Phase 1 Complete ✅  
**Next:** Fix Mobile Message Sending Issue ⏳
