# Offline Support - Quick Reference

## 🎯 For Developers

### Import the Service

```typescript
import offlineStorage from "@/services/offlineStorage";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
```

### Check Network Status

```typescript
const { isOnline, isOffline, isConnected, type } = useNetworkStatus();

if (isOffline) {
  // Queue action for later
}
```

### Queue a Recording

```typescript
await offlineStorage.queueEvaluation({
  id: `${sessionId}-${Date.now()}`,
  audioUri: "file:///path/to/audio.m4a",
  topicId: "topic-123",
  sessionId: "session-456",
  timestamp: Date.now(),
  metadata: {
    topicTitle: "Your Hometown",
    question: "Describe where you live",
    duration: 45,
  },
});
```

### Cache Topics

```typescript
// Automatically cache when online
useEffect(() => {
  if (isOnline && topics.length > 0) {
    offlineStorage.cacheTopics(topics);
  }
}, [isOnline, topics]);

// Load cached topics when offline
useEffect(() => {
  if (isOffline) {
    offlineStorage.getCachedTopics().then(setTopics);
  }
}, [isOffline]);
```

### Process Queue

```typescript
useEffect(() => {
  if (isOnline) {
    offlineStorage.processQueue(async (item) => {
      await api.uploadAudio(item.sessionId, item.audioUri);
    });
  }
}, [isOnline]);
```

### Add Banner to Screen

```tsx
<ScreenContainer>
  <OfflineBanner showQueueCount />
  {/* Your content */}
</ScreenContainer>
```

### Get Statistics

```typescript
const stats = await offlineStorage.getStats();
console.log(stats.queuedEvaluations); // 3
console.log(stats.cachedTopics); // 15
console.log(stats.lastSync); // 1704067200000
```

## 📱 For Users

### What happens when offline?

**Yellow Banner Appears:**

```
📡 You are offline
2 recordings will sync when online
```

**You Can Still:**

- Browse cached topics (last 7 days)
- Record audio answers
- Navigate the app
- View previous results

**Automatic When Online:**

- All recordings upload automatically
- Green "Back online" banner shows briefly
- Fresh topics download
- Cache updates

### No Action Required

The app handles everything automatically:

1. Detects offline → Queues recordings
2. Detects online → Syncs recordings
3. Manages cache → Removes old data
4. Shows status → Visual feedback

## 🔧 Utilities

### Clear Cache Only

```typescript
await offlineStorage.clearCache();
// Keeps queue, removes cached topics
```

### Clear Everything

```typescript
await offlineStorage.clearAll();
// Removes queue, cache, recordings
```

### Remove Single Item

```typescript
await offlineStorage.removeFromQueue(id);
await offlineStorage.removeOfflineRecording(id);
```

### Manual Sync Check

```typescript
const isOnline = await offlineStorage.isOnline();
if (isOnline) {
  // Safe to make network calls
}
```

## 📊 Constants

```typescript
CACHE_DURATION = 7 days (604,800,000 ms)

STORAGE_KEYS = {
  QUEUED_EVALUATIONS: 'queued_evaluations',
  CACHED_TOPICS: 'cached_topics',
  OFFLINE_RECORDINGS: 'offline_recordings',
  LAST_SYNC: 'last_sync_timestamp'
}
```

## 🐛 Debug Logs

Enable console logs to see:

```
✅ Queued evaluation: abc123
✅ Cached 15 topics
📡 Network: OFFLINE
📤 Processing 2 queued items...
✅ Processed queued item: abc123
📊 Queue processing complete: 2 success, 0 failed
```

## ⚠️ Important Notes

1. **Cache expires after 7 days** - Stale topics auto-removed
2. **Queue persists** - Survives app restart
3. **Async operations** - Always await storage calls
4. **Type safety** - Full TypeScript support
5. **Error handling** - All methods have try/catch

## 🎯 Common Patterns

### Screen Template

```typescript
export const MyScreen = () => {
  const { isOnline, isOffline } = useNetworkStatus();
  const [cachedData, setCachedData] = useState([]);

  // Cache data when online
  useEffect(() => {
    if (isOnline && data.length > 0) {
      offlineStorage.cacheTopics(data);
    }
  }, [isOnline, data]);

  // Load cached data when offline
  useEffect(() => {
    if (isOffline) {
      offlineStorage.getCachedTopics().then(setCachedData);
    }
  }, [isOffline]);

  // Process queue when back online
  useEffect(() => {
    if (isOnline) {
      offlineStorage.processQueue(uploadCallback);
    }
  }, [isOnline]);

  return (
    <ScreenContainer>
      <OfflineBanner showQueueCount />
      {/* Content */}
    </ScreenContainer>
  );
};
```

### Submit Handler with Offline Support

```typescript
const handleSubmit = async () => {
  if (isOffline) {
    // Queue for later
    await offlineStorage.queueEvaluation(data);
    Alert.alert("Saved", "Will sync when online");
    navigation.goBack();
  } else {
    // Upload immediately
    await api.upload(data);
    navigation.goBack();
  }
};
```

---

**File Location:** `/mobile/src/services/offlineStorage.ts`  
**Documentation:** `/mobile/docs/OFFLINE-SUPPORT-COMPLETE.md`  
**Status:** Production Ready ✅
