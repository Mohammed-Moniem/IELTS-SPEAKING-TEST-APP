# Gamification Integration Guide

## Quick Start

The gamification system is now ready to use! Here's how to integrate it into your screens.

## 1. Displaying Points Balance

### Simple Display (Pill Component)

Add the `PointsPill` component to any screen header:

```tsx
import { PointsPill } from "../components/PointsPill";

// In your screen component
<PointsPill
  onPress={() => navigation.navigate("PointsDetail")}
  showTier={true}
  compact={false}
/>;
```

**Props:**

- `onPress`: Optional callback when tapped (typically navigate to points detail screen)
- `showTier`: Show tier name (default: true)
- `compact`: Compact mode for tight spaces (default: false)

### Using the Hook Directly

For custom UIs, use the `usePoints` hook:

```tsx
import { usePoints } from "../hooks";

function MyComponent() {
  const {
    balance,
    totalEarned,
    currentTierName,
    nextTier,
    loading,
    error,
    refresh,
  } = usePoints();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Text>{balance} points</Text>
      <Text>Tier: {currentTierName}</Text>
      {nextTier && (
        <Text>
          {nextTier.pointsRemaining} pts to {nextTier.tierName}
        </Text>
      )}
    </View>
  );
}
```

## 2. Celebration Animations

### Automatic Celebrations

The celebration modal automatically shows when points are earned via socket events. No code needed!

Just add it to your screen wrapper or root component:

```tsx
import { PointsCelebrationModal } from "../components/PointsCelebrationModal";
import { usePointsCelebration } from "../hooks";

function YourScreen() {
  const { celebration, hideCelebration } = usePointsCelebration();

  return (
    <View>
      {/* Your screen content */}

      <PointsCelebrationModal
        visible={celebration.visible}
        pointsEarned={celebration.pointsEarned}
        reason={celebration.reason}
        newBalance={celebration.newBalance}
        onClose={hideCelebration}
      />
    </View>
  );
}
```

### Manual Celebration (Optional)

Trigger celebrations programmatically:

```tsx
const { showCelebration } = usePointsCelebration();

// After completing an action
showCelebration(50, "Completed daily practice", 1250);
```

## 3. Toast Notifications

### Automatic Toasts

The toast system is already integrated in App.tsx. Just use the service:

```tsx
import { toastService } from "../services/toastService";

// Success notification
toastService.success("Profile updated successfully!");

// Error notification
toastService.error("Failed to save changes");

// Warning
toastService.warning("Slow internet connection detected");

// Info
toastService.info("New feature available!");

// Achievement notification
toastService.achievementUnlocked("Early Bird", 50);

// Small points notification (< 50 pts)
toastService.pointsGranted(10, "Daily login bonus");

// Discount redemption
toastService.discountRedeemed("Gold", 15);
```

**Best Practices:**

- Use toasts for small, non-critical updates
- Use celebration modal for significant point awards (≥ 50 pts)
- Toasts are automatically debounced and spam-protected

## 4. Redeeming Discounts

### Using the Points Service

```tsx
import { pointsService, DiscountTier } from "../services/api";
import { toastService } from "../services/toastService";

async function redeemDiscount(tier: DiscountTier) {
  try {
    const result = await pointsService.redeemDiscount(tier);

    // Show success toast
    const tierInfo = pointsService.getDiscountTierInfo(tier);
    toastService.discountRedeemed(tierInfo.name, tierInfo.discountPercentage);

    // Show coupon code
    Alert.alert(
      "Discount Unlocked!",
      `Your ${tierInfo.name} coupon: ${result.couponCode}`,
      [
        { text: "Copy", onPress: () => Clipboard.setString(result.couponCode) },
        { text: "OK" },
      ]
    );
  } catch (error) {
    toastService.error("Failed to redeem discount");
  }
}
```

### Using the Hook (Recommended)

```tsx
import { usePoints } from "../hooks";
import { DiscountTier } from "../services/api";

function DiscountScreen() {
  const { balance, availableDiscounts, redeemDiscount, loading } = usePoints();

  const handleRedeem = async (tier: DiscountTier) => {
    const result = await redeemDiscount(tier);
    if (result) {
      // Success - result contains coupon code
      Alert.alert("Success!", `Coupon: ${result.couponCode}`);
    }
  };

  return (
    <View>
      <Text>Balance: {balance} pts</Text>
      {availableDiscounts.map((discount) => (
        <Button
          key={discount.tier}
          title={`Redeem ${discount.name} (${discount.pointsRequired} pts)`}
          onPress={() => handleRedeem(discount.tier)}
          disabled={loading}
        />
      ))}
    </View>
  );
}
```

## 5. Transaction History

```tsx
import { usePoints } from "../hooks";

function TransactionHistory() {
  const { transactions, loading, fetchTransactions } = usePoints();

  // Load more transactions
  const loadMore = () => {
    fetchTransactions(transactions.length + 20);
  };

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <View style={styles.transaction}>
          <Text style={styles.amount}>
            {item.amount > 0 ? "+" : ""}
            {item.amount} pts
          </Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={loading}
      onRefresh={() => fetchTransactions(20)}
    />
  );
}
```

## 6. Integration Examples

### Home Screen Header

```tsx
// src/screens/HomeScreen.tsx
import { PointsPill } from "../components/PointsPill";

export function HomeScreen({ navigation }) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
        <PointsPill
          onPress={() => navigation.navigate("PointsDetail")}
          compact={false}
        />
      </View>
      {/* Rest of your screen */}
    </View>
  );
}
```

### Profile Screen with Points

```tsx
// src/screens/ProfileScreen.tsx
import { usePoints } from "../hooks";
import { PointsPill } from "../components/PointsPill";

export function ProfileScreen({ navigation }) {
  const { balance, currentTierName, totalEarned } = usePoints();

  return (
    <ScrollView>
      {/* Header */}
      <View style={styles.header}>
        <Text>Profile</Text>
        <PointsPill onPress={() => navigation.navigate("PointsDetail")} />
      </View>

      {/* Points Section */}
      <View style={styles.pointsSection}>
        <Text style={styles.label}>Your Points</Text>
        <Text style={styles.balance}>{balance}</Text>
        <Text style={styles.tier}>{currentTierName} Tier</Text>
        <Text style={styles.totalEarned}>Total Earned: {totalEarned} pts</Text>
        <Button
          title="Redeem Discount"
          onPress={() => navigation.navigate("RedeemDiscount")}
        />
      </View>

      {/* Rest of profile */}
    </ScrollView>
  );
}
```

### Practice Session Completion

```tsx
// src/screens/PracticeScreen.tsx
import { usePointsCelebration } from "../hooks";
import { PointsCelebrationModal } from "../components/PointsCelebrationModal";

export function PracticeScreen() {
  const { celebration, hideCelebration } = usePointsCelebration();

  // The celebration automatically triggers when backend grants points
  // via socket event after practice completion

  return (
    <View>
      {/* Your practice UI */}

      {/* Add celebration modal */}
      <PointsCelebrationModal
        visible={celebration.visible}
        pointsEarned={celebration.pointsEarned}
        reason={celebration.reason}
        newBalance={celebration.newBalance}
        onClose={hideCelebration}
      />
    </View>
  );
}
```

## 7. Socket Events

The system automatically listens to these socket events:

### `points:granted`

Emitted by backend when user earns points.

**Payload:**

```typescript
{
  userId: string;
  amount: number;
  type: 'practice' | 'achievement' | 'referral' | 'bonus';
  description: string;
  balance: number;
  metadata?: Record<string, any>;
}
```

**Auto-handled by:**

- `usePoints` hook (updates balance)
- `usePointsCelebration` hook (shows modal)

**No code needed** - just ensure socket is connected (already done in App.tsx)

## 8. Discount Tiers

| Tier     | Points Required | Discount |
| -------- | --------------- | -------- |
| Bronze   | 1,000           | 5%       |
| Silver   | 2,500           | 10%      |
| Gold     | 5,000           | 15%      |
| Platinum | 7,500           | 20%      |

Access tier info:

```tsx
import { pointsService, DiscountTier } from "../services/api";

const bronzeInfo = pointsService.getDiscountTierInfo(DiscountTier.BRONZE);
// { tier: 'BRONZE', name: 'Bronze', pointsRequired: 1000, discountPercentage: 5 }

const allTiers = pointsService.getAllDiscountTiers();
// Array of all 4 tiers
```

## 9. Error Handling

All hooks and services handle errors gracefully:

```tsx
const { error, loading } = usePoints();

if (error) {
  return (
    <View>
      <Text>Error loading points: {error}</Text>
      <Button title="Retry" onPress={refresh} />
    </View>
  );
}
```

Toast service automatically shows error toasts for failed operations.

## 10. Testing

### Test Points Earning

1. Complete a practice session
2. Watch for celebration modal
3. Check balance updates in real-time
4. Verify transaction appears in history

### Test Discount Redemption

1. Navigate to discount screen
2. Attempt to redeem with insufficient points (should show error)
3. Earn enough points
4. Successfully redeem discount
5. Verify coupon code received
6. Check balance deducted

### Test Toast System

```tsx
// In any screen
toastService.success("Test toast 1");
toastService.success("Test toast 2");
toastService.success("Test toast 3");
// Should queue and display sequentially, not spam
```

## 11. Performance Tips

- **Lazy Loading:** Fetch transactions only when needed
- **Pagination:** Use `fetchTransactions(limit)` to load in batches
- **Debouncing:** Toast service automatically prevents spam
- **Socket Cleanup:** Hooks automatically clean up socket listeners
- **Memoization:** Use `useMemo` for computed values if performance issues

## 12. Troubleshooting

### Points not updating?

- Check socket connection in console
- Verify backend is emitting `points:granted` event
- Check `usePoints` hook is subscribed

### Celebration not showing?

- Ensure `usePointsCelebration` hook is used
- Check `PointsCelebrationModal` is rendered
- Verify socket event includes correct payload

### Toasts not appearing?

- Verify `ToastContainer` is in App.tsx
- Check `toastService` import path
- Ensure safe area insets are working

### Discount redemption failing?

- Check user has sufficient balance
- Verify auth token is valid
- Check backend `/api/points/redeem` endpoint

---

**Need Help?** Check the progress doc: `docs/GAMIFICATION-PHASE-1-PROGRESS.md`
