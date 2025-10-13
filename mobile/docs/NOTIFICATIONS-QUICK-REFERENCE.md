# Push Notifications - Quick Reference

## 🎯 For Developers

### Import the Service

```typescript
import notificationService from "@/services/notificationService";
import { useNotificationManager } from "@/hooks/useNotificationManager";
```

### Initialize (Done in App.tsx)

```typescript
await notificationService.initialize();
```

### Schedule Daily Reminder

```typescript
// 7:00 PM daily reminder
await notificationService.scheduleDailyReminder(19, 0, true);

// Disable reminder
await notificationService.scheduleDailyReminder(19, 0, false);
```

### Send Instant Notifications

```typescript
// Achievement
await notificationService.sendAchievementNotification(
  'First Practice',
  'You completed your first practice session!'
);

// Streak (active)
await notificationService.sendStreakNotification(7, false);

// Streak (at risk)
await notificationService.sendStreakNotification(5, true);

// Inactivity
await notificationService.sendInactivityReminder(3);

// Feedback ready
await notificationService.sendFeedbackReadyNotification('Your Hometown');

// Milestone
await notificationService.sendMilestoneNotification(
  '50 Sessions',
  'You've completed 50 practice sessions!'
);
```

### Custom Notifications

```typescript
await notificationService.scheduleNotification(
  "Custom Title",
  "Custom body text",
  {
    type: "timeInterval" as any,
    seconds: 60,
    repeats: false,
  },
  { customData: "value" }
);
```

### Track User Activity

```typescript
const { trackPracticeSession, notifyFeedbackReady, sendAchievement } =
  useNotificationManager();

// When user completes practice
await trackPracticeSession();

// When feedback is ready
await notifyFeedbackReady("Part 1: Your Hometown");

// Custom achievement
await sendAchievement("Speed Runner", "Completed 10 sessions today!");
```

### Manage Notifications

```typescript
// Get all scheduled
const notifications = await notificationService.getAllScheduledNotifications();

// Cancel specific
await notificationService.cancelNotification(identifier);

// Cancel by category
await notificationService.cancelNotificationsByCategory("daily_reminder");

// Cancel all
await notificationService.cancelAllNotifications();
```

### Permission Management

```typescript
// Check status
const status = await notificationService.getPermissionStatus();
// Returns: 'granted' | 'denied' | 'undetermined'

// Request permission
const granted = await notificationService.requestPermissions();

// Get push token
const token = notificationService.getPushToken();
```

### Badge Management

```typescript
// Get badge count
const count = await notificationService.getBadgeCount();

// Set badge count
await notificationService.setBadgeCount(5);

// Clear badge
await notificationService.clearBadgeCount();
```

## 📱 For Users

### Enable Notifications

**Settings → Notifications:**

1. Tap "Enable Notifications"
2. Grant permission when prompted
3. Configure preferences

### Notification Types

**Daily Reminder** 🎯

- Customizable time (9 AM, 1 PM, 7 PM, 9 PM)
- Can be toggled on/off
- Repeats daily

**Achievements** 🏆

- Instant when earned
- Celebrates milestones
- Can be disabled

**Streak Tracking** 🔥

- Warns when at risk (evening)
- Celebrates milestones (7, 14, 30 days)
- Toggle on/off

**Inactivity** 👋

- After 3, 7, or 14 days
- Gentle reminders
- Can be disabled

**Feedback Ready** ✅

- After AI evaluation
- Lets you know results available
- Toggle on/off

### Time Presets

- 9:00 AM - Morning practice
- 1:00 PM - Lunch break
- 7:00 PM - Evening (default)
- 9:00 PM - Before bed

### Test Notification

Use the "Send Test Notification" button to verify:

- Permissions working
- Sound/vibration configured
- Visual appearance correct

## 🔔 Notification Categories

### Category IDs

```typescript
type NotificationCategory =
  | "daily_reminder"
  | "achievement"
  | "streak"
  | "inactivity"
  | "feedback_ready"
  | "milestone";
```

### Android Channels

```typescript
// Default channel - MAX importance
"default";

// Reminders channel - HIGH importance
"reminders";

// Achievements channel - DEFAULT importance
"achievements";
```

## 🎨 Notification Templates

### Daily Reminder

```
Title: 🎯 Time to practice!
Body: Keep your IELTS speaking skills sharp with a quick practice session.
Category: daily_reminder
```

### Achievement

```
Title: 🏆 Achievement Unlocked!
Body: [Achievement Name]: [Description]
Category: achievement
```

### Streak (Active)

```
Title: 🔥 [X]-day streak!
Body: Amazing! You've practiced for [X] days in a row. Keep it up!
Category: streak
```

### Streak (At Risk)

```
Title: 🔥 Don't break your streak!
Body: You're about to lose your [X]-day streak. Practice now to keep it going!
Category: streak
```

### Inactivity

```
Title: 👋 We miss you!
Body: It's been [X] days since your last practice. Ready to get back on track?
Category: inactivity
```

### Feedback Ready

```
Title: ✅ Your feedback is ready!
Body: Check out your detailed feedback for "[Topic Title]"
Category: feedback_ready
```

### Milestone

```
Title: 🎉 Milestone Reached!
Body: [Milestone]: [Description]
Category: milestone
```

## 🔧 Activity Tracking

### User Activity Structure

```typescript
{
  lastPracticeDate: '2025-10-09',  // ISO date string
  currentStreak: 7,                 // Consecutive days
  practiceCount: 45                 // Total sessions
}
```

### Streak Calculation

**Same Day:**

- Don't increment streak
- Update last practice date

**Next Day (Yesterday):**

- Increment streak by 1
- Update last practice date

**Missed Days:**

- Reset streak to 1
- Update last practice date

### Milestone Thresholds

**Streak Milestones:**

```typescript
[7, 14, 30, 60, 100] days
```

**Practice Count Milestones:**

```typescript
[10, 25, 50, 100, 250, 500] sessions
```

**Inactivity Triggers:**

```typescript
[3, 7, 14] days since last practice
```

## 🐛 Debugging

### Enable Logging

```typescript
// Service already logs important events:
✅ Push token: ExponentPushToken[...]
✅ Daily reminder scheduled at 19:0
📬 Notification received: { ... }
👆 Notification tapped: { category: 'daily_reminder' }
```

### Common Issues

**No notifications appearing:**

- Check: `Device.isDevice` (simulator not supported)
- Check: Permission status = 'granted'
- Check: Settings toggles enabled

**Daily reminder not firing:**

- Check: Correct time zone
- Check: App not force-killed (iOS limitation)
- Check: Background app refresh enabled

**Push token is null:**

- Check: EAS project ID in app.json/app.config.js
- Check: Internet connection
- Check: Not in airplane mode

### Test Checklist

```typescript
// 1. Initialize
await notificationService.initialize();

// 2. Check permission
const status = await notificationService.getPermissionStatus();

// 3. Schedule test
await notificationService.scheduleNotification(
  "Test",
  "Testing notifications",
  { type: "timeInterval" as any, seconds: 5, repeats: false }
);

// 4. Wait 5 seconds
// 5. Verify notification appears
```

## 📊 Storage Keys

### Notification Settings

```
Key: 'notification_settings'
Location: AsyncStorage
Format: JSON
```

### User Activity

```
Key: 'user_activity'
Location: AsyncStorage
Format: JSON
```

## 🎯 Best Practices

1. **Always check permissions** before sending notifications
2. **Track activity** after successful practice completion
3. **Respect user preferences** - check settings before sending
4. **Provide test option** - let users verify setup
5. **Handle errors gracefully** - catch and log all failures
6. **Clean up listeners** - remove on component unmount
7. **Timezone aware** - use local time for scheduling
8. **Batch updates** - don't spam notifications
9. **Meaningful data** - include navigation hints in payload
10. **Monitor metrics** - track engagement rates

## 🚀 Advanced Usage

### Listen to Notifications

```typescript
// In App.tsx or root component
const notificationListener =
  notificationService.addNotificationReceivedListener((notification) => {
    // Handle notification received (foreground)
  });

const responseListener = notificationService.addNotificationResponseListener(
  (response) => {
    // Handle notification tapped
    const category = response.notification.request.content.data.category;
    // Navigate based on category
  }
);

// Cleanup
return () => {
  notificationListener.remove();
  responseListener.remove();
};
```

### Custom Scheduling

```typescript
// Weekly on Mondays at 10 AM
await notificationService.scheduleNotification(
  "Weekly Review",
  "Time to review your weekly progress",
  {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: 2, // Monday (1 = Sunday)
    hour: 10,
    minute: 0,
  }
);
```

### Batch Operations

```typescript
// Get all scheduled
const all = await notificationService.getAllScheduledNotifications();

// Filter and cancel
const reminders = all.filter((n) => n.data?.category === "daily_reminder");
for (const reminder of reminders) {
  await notificationService.cancelNotification(reminder.identifier);
}
```

## ✨ Integration Examples

### After Practice Session

```typescript
const handleSessionComplete = async () => {
  try {
    // Save session
    await saveSession();

    // Track activity
    await trackPracticeSession();

    // Notify feedback ready (after AI processes)
    setTimeout(() => {
      notifyFeedbackReady(sessionTitle);
    }, 30000); // 30 seconds for AI processing
  } catch (error) {
    console.error(error);
  }
};
```

### Achievement System

```typescript
const checkAchievements = async (stats: UserStats) => {
  if (stats.practiceCount === 10) {
    await sendAchievement("Getting Started", "Completed 10 practice sessions");
  }

  if (stats.currentStreak === 7) {
    await sendAchievement("Week Warrior", "Practiced 7 days in a row!");
  }
};
```

---

**Files:**

- Service: `/mobile/src/services/notificationService.ts`
- Hook: `/mobile/src/hooks/useNotificationManager.ts`
- Settings: `/mobile/src/screens/Settings/NotificationSettingsScreen.tsx`
- Documentation: `/mobile/docs/PUSH-NOTIFICATIONS-COMPLETE.md`

**Status:** Production Ready ✅
