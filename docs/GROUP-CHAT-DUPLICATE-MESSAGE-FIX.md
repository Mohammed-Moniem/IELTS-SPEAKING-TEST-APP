# Group Chat Duplicate Message Fix

## Date

October 22, 2025

## Issue

Group chat messages were appearing twice (duplicate messages). Logs showed the same message being received and added to state twice:

```
LOG  Group message received: {...}
LOG  📨 New message received in useChat
LOG  ✅ Adding message to local state
LOG  Group message received: {...}  // DUPLICATE
LOG  📨 New message received in useChat  // DUPLICATE
LOG  ✅ Adding message to local state  // DUPLICATE
```

## Root Cause

**Backend was emitting the same message twice:**

In `/micro-service-boilerplate-main/src/loaders/SocketIOLoader.ts` (lines 177-178):

```typescript
// ❌ BEFORE - Emits twice
io!.to(`group:${data.groupId}`).emit("group:message:receive", payload); // To all group members
socket.emit("group:message:receive", payload); // Directly to sender
```

Since the sender is a member of the group and has joined the group room, they receive:

1. ✉️ Message #1: From `io.to('group:...')` broadcast (as a group member)
2. ✉️ Message #2: From `socket.emit()` direct send (as the sender)

## Solution

**Remove the duplicate direct emission to the sender:**

```typescript
// ✅ AFTER - Emits once
io!.to(`group:${data.groupId}`).emit("group:message:receive", payload); // To all group members (includes sender)
```

The sender receives the message once through the group room broadcast, same as all other members.

## Additional Improvements

**Reduced excessive re-renders** in ChatScreen by moving params logging into a useEffect:

```typescript
// ❌ BEFORE - Logs on every render
console.log("📊 ChatScreen params:", { ... });

// ✅ AFTER - Logs once on mount
useEffect(() => {
  console.log("📊 ChatScreen params:", { ... });
}, []);
```

This prevents the log from appearing 20+ times per navigation.

## Files Changed

1. **`/micro-service-boilerplate-main/src/loaders/SocketIOLoader.ts`**

   - Removed line: `socket.emit('group:message:receive', payload);`
   - Kept only: `io!.to('group:${data.groupId}').emit('group:message:receive', payload);`

2. **`/mobile/src/screens/Social/ChatScreen.tsx`**
   - Moved `console.log("📊 ChatScreen params")` into `useEffect` with empty dependencies

## Testing Instructions

1. **Restart Backend:**

   ```bash
   # Backend will auto-reload, or manually restart
   ```

2. **Test Message Sending:**

   - Open group chat
   - Send a message "Hello"
   - ✅ Expected: Message appears once (not twice)
   - ✅ Expected: Only one "Group message received" log
   - ✅ Expected: Message colored correctly (green for own)

3. **Test Multi-User:**

   - Device 1: Send "Test from device 1"
   - Device 2: Should see message once
   - Device 2: Send "Test from device 2"
   - Device 1: Should see message once

4. **Verify Logs:**
   - Send a message
   - Check logs: Should see **ONE** "Group message received" log
   - No duplicate "Adding message to local state" logs

## Expected Behavior After Fix

**Sender Side:**

```
📤 sendGroupMessage called: { groupId: "...", content: "Test" }
Group message received: {...}  // ONCE
📨 New message received in useChat
✅ Adding message to local state  // ONCE
```

**Recipient Side:**

```
Group message received: {...}  // ONCE
📨 New message received in useChat
✅ Adding message to local state  // ONCE
```

## Technical Explanation

### Socket.IO Room Broadcasting

When you emit to a room in Socket.IO:

```typescript
io.to("room-name").emit("event", data);
```

This sends the event to **all sockets that have joined that room**, including:

- Other users in the room
- The current user (if they've joined the room)

Therefore, you should **NOT** also emit directly to the sender's socket:

```typescript
socket.emit("event", data); // ❌ UNNECESSARY - sender already in room
```

### Why This Pattern Matters

**Correct Pattern:**

```typescript
// All group members (including sender) receive via room broadcast
io.to(`group:${groupId}`).emit("group:message:receive", message);
```

**Incorrect Pattern:**

```typescript
// Sender receives twice - once from room, once from direct emit
io.to(`group:${groupId}`).emit("group:message:receive", message);
socket.emit("group:message:receive", message); // ❌ DUPLICATE
```

### When to Use Direct Socket Emission

Use `socket.emit()` only when you want to send an event **exclusively to the sender**:

```typescript
// ✅ Confirmation event - only sender needs this
socket.emit("message:sent", { status: "delivered", messageId: "..." });

// ✅ Error event - only sender needs this
socket.emit("group:message:error", { error: "Failed to send" });
```

For broadcast events (messages everyone should receive), use only room emission.

## Status

✅ **Fixed** - Duplicate message emission removed
✅ **Tested** - Zero compilation errors
⏳ **Pending** - User testing with real group chat

## Related Documents

- [GROUP-CHAT-MESSAGES-FIX.md](./GROUP-CHAT-MESSAGES-FIX.md) - Original group chat implementation
- [SOCKET-EVENTS.md](./SOCKET-EVENTS.md) - Socket event documentation (if exists)
