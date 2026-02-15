# 🧪 Gamification Testing Guide

## Overview

This guide will walk you through testing the complete gamification system end-to-end.

---

## 🚀 Prerequisites

### Backend Requirements

Ensure these endpoints are running:

- ✅ `GET /api/points/summary` - Returns user's points, tier, stats
- ✅ `GET /api/points/transactions` - Returns transaction history
- ✅ `POST /api/points/redeem` - Processes discount redemption
- ✅ Socket server running on port configured in `.env`
- ✅ Socket event `points:granted` configured

### Mobile App Setup

```bash
cd mobile
npm install  # or yarn install
npm start    # or expo start
```

---

## 📱 Test Scenarios

### Scenario 1: First-Time User Experience

**Goal:** Verify gamification system for new users

#### Steps:

1. **Login/Register** to the app
2. **Navigate to Home screen**
3. **Verify PointsPill** appears in header (should show "0" or initial points)
4. **Tap PointsPill**
   - ✅ Should navigate to PointsDetailScreen
   - ✅ Should show 0 balance (or initial bonus)
   - ✅ Should show current tier (likely Bronze)
   - ✅ Should show empty transaction list or profile completion bonus

#### Expected Results:

- PointsPill visible in header: ⭐ 0 (or 50 if profile completion bonus)
- Points detail screen loads without errors
- Tier card shows "Bronze" with progress bar at 0%
- Transaction list shows "No transactions yet" or profile completion entry

---

### Scenario 2: Earning Points (Practice Session)

**Goal:** Test real-time points grant and celebration

#### Steps:

1. **Complete a practice session**

   - Navigate to Practice tab
   - Complete a speaking session
   - Submit your response

2. **Watch for:**

   - 🎉 **Celebration modal** with confetti animation
   - 🔔 **Toast notification**: "🌟 +20 points - Practice completed"
   - ⭐ **PointsPill update** in header

3. **Verify points updated**
   - Check PointsPill shows new balance
   - Navigate to PointsDetailScreen
   - Verify transaction appears in history

#### Expected Results:

- Celebration modal appears for 2-3 seconds with confetti
- Toast notification slides in from top
- PointsPill updates immediately (no refresh needed)
- Transaction appears at top of history list
- Balance card shows correct total

---

### Scenario 3: Viewing Points Dashboard

**Goal:** Test PointsDetailScreen functionality

#### Steps:

1. **Navigate to PointsDetailScreen** (tap PointsPill from any screen)

2. **Verify balance card displays:**

   - ✅ Large balance number
   - ✅ Total earned stat
   - ✅ Total redeemed stat

3. **Verify tier card displays:**

   - ✅ Current tier name (Bronze/Silver/Gold/Platinum)
   - ✅ Progress bar to next tier
   - ✅ "X pts to [TierName]" text

4. **Test transaction filters:**

   - Tap "All" → Shows all transactions
   - Tap "Earned" → Shows only positive transactions
   - Tap "Redeemed" → Shows only redemptions

5. **Test pull-to-refresh:**

   - Pull down on transaction list
   - Verify refresh indicator appears
   - Verify data reloads

6. **Test infinite scroll:**
   - Scroll to bottom of transaction list
   - Verify loading indicator appears
   - Verify more transactions load (if available)

#### Expected Results:

- All stats display correctly
- Tier progress bar animates smoothly
- Filters work without layout jumps
- Pull-to-refresh feels responsive
- No console errors

---

### Scenario 4: Discount Redemption Flow

**Goal:** Test full redemption process

#### Steps:

1. **Ensure you have enough points** (1,000+ for Bronze)

   - If not, complete practice sessions or ask backend to grant points

2. **Navigate to RedeemDiscountScreen:**

   - From PointsDetailScreen → Tap "Redeem Points" button
   - OR directly navigate if testing

3. **Verify screen displays:**

   - ✅ Balance card at top
   - ✅ Info banner: "Discount coupons are valid for 30 days"
   - ✅ 4 tier cards (Bronze, Silver, Gold, Platinum)
   - ✅ "How to Earn More" section at bottom

4. **Test tier selection:**

   - Tap on an available tier (points ≥ required)
   - Verify selection state (white background, checkmark)
   - Tap another tier → Verify selection changes

5. **Test locked tiers:**

   - Tap on a tier you don't have points for
   - Verify it shows locked state (gray, lock icon)
   - Verify "Redeem" button stays disabled

6. **Test redemption:**

   - Select an available tier (e.g., Bronze - 1,000 pts)
   - Tap "Redeem for 5% Discount" button
   - Verify confirmation alert appears
   - Tap "Confirm"
   - Wait for API call

7. **Verify success modal:**

   - ✅ Success icon (checkmark)
   - ✅ Discount percentage (e.g., "5% Discount")
   - ✅ Coupon code in dashed box
   - ✅ "Copy Code" button
   - ✅ "Use on Subscription" button
   - ✅ "Done" button

8. **Test copy code:**

   - Tap "Copy Code" button
   - Verify success toast: "Coupon code copied!"
   - Verify clipboard contains code

9. **Verify balance updated:**
   - Close modal
   - Check PointsPill shows reduced balance
   - Navigate to PointsDetailScreen
   - Verify transaction list shows redemption (negative amount)

#### Expected Results:

- Smooth selection animations
- API call completes without errors
- Coupon code is valid format
- Balance updates immediately
- Transaction logged correctly
- No duplicate redemptions allowed

---

### Scenario 5: Navigation Testing

**Goal:** Verify all navigation paths work

#### Entry Points to Test:

1. **From HomeScreen:**

   ```
   Home → Tap PointsPill → PointsDetailScreen
   ```

2. **From ProfileScreen:**

   ```
   ProfileMenu → Profile → Tap PointsPill → PointsDetailScreen
   ```

3. **From SocialHomeScreen:**

   ```
   Social Tab → Tap PointsPill → PointsDetailScreen
   ```

4. **Within Points Screens:**
   ```
   PointsDetailScreen → Redeem Button → RedeemDiscountScreen
   RedeemDiscountScreen → Back → PointsDetailScreen
   PointsDetailScreen → Back → Previous Screen
   ```

#### Expected Results:

- All navigation paths work
- Back navigation returns to correct screen
- State preserved when returning
- No navigation errors in console
- Smooth transitions

---

### Scenario 6: Real-Time Updates

**Goal:** Test socket integration

#### Steps:

1. **Open app and login**
2. **Navigate to PointsDetailScreen**
3. **Keep app open**
4. **Trigger backend event** (have backend manually grant points via API or complete action)
5. **Watch for real-time updates:**
   - 🎉 Celebration modal appears
   - 🔔 Toast notification appears
   - ⭐ Balance updates without refresh
   - 📊 Transaction list updates

#### Expected Results:

- Updates happen instantly
- No need to manually refresh
- Smooth animations
- No duplicate notifications

---

### Scenario 7: Edge Cases & Error Handling

#### Test 1: Insufficient Points

1. Try to redeem discount without enough points
2. Verify locked state and disabled button
3. No error toasts should appear

#### Test 2: Network Failure

1. Disable network connection
2. Try to load PointsDetailScreen
3. Verify error state displays
4. Tap retry button
5. Verify it attempts reload

#### Test 3: API Error

1. Configure backend to return error
2. Try to redeem discount
3. Verify error toast appears with message
4. Verify balance doesn't change

#### Test 4: Empty Transaction List

1. New user with 0 transactions
2. Navigate to PointsDetailScreen
3. Verify empty state displays:
   - Document icon
   - "No transactions yet"
   - Educational text

#### Test 5: Filter Edge Cases

1. Filter by "Earned" with no earned points
2. Verify empty state
3. Filter by "Redeemed" with no redemptions
4. Verify empty state

#### Expected Results:

- All error states handled gracefully
- No crashes or console errors
- Clear user feedback
- Retry mechanisms work

---

### Scenario 8: Performance Testing

#### Memory Leaks:

1. Navigate between screens 10+ times
2. Check for memory increases in dev tools
3. Verify socket listeners cleaned up

#### Animation Performance:

1. Grant points multiple times rapidly
2. Verify celebration modal doesn't queue/overlap
3. Verify toast notifications don't spam

#### List Performance:

1. Load 100+ transactions
2. Test scroll performance
3. Verify infinite scroll pagination works
4. No frame drops during scroll

---

## 🐛 Common Issues & Fixes

### Issue: PointsPill shows "Loading..."

**Cause:** API call to `/api/points/summary` failing  
**Fix:** Check backend logs, verify auth token, check network

### Issue: Celebration modal doesn't appear

**Cause:** Socket not connected or event not firing  
**Fix:** Check socket connection in logs, verify backend emits event

### Issue: Coupon code not copying

**Cause:** Clipboard permissions or API issue  
**Fix:** Check Clipboard.setStringAsync() logs, verify permissions

### Issue: Navigation TypeError

**Cause:** Missing screen in AppTabParamList  
**Fix:** Verify PointsDetail and RedeemDiscount added to types

### Issue: Header layout broken

**Cause:** Gap style not supported in older RN  
**Fix:** Use marginLeft: 12 instead of gap: 12

---

## ✅ Final Checklist

Before marking as complete, verify:

- [ ] PointsPill appears in 3 locations (Home, Profile, Social)
- [ ] PointsPill shows correct balance
- [ ] PointsDetailScreen loads without errors
- [ ] Balance, tier, and stats display correctly
- [ ] Transaction list loads and filters work
- [ ] Pull-to-refresh and infinite scroll work
- [ ] RedeemDiscountScreen displays all tiers
- [ ] Tier selection and locked states work
- [ ] Redemption completes successfully
- [ ] Coupon code displays and copies
- [ ] Balance updates after redemption
- [ ] Celebration modal appears on points grant
- [ ] Toast notifications work correctly
- [ ] Real-time socket updates work
- [ ] All navigation paths work
- [ ] Back navigation returns to correct screen
- [ ] Error states handled gracefully
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] No memory leaks
- [ ] Smooth animations

---

## 📊 Test Results Template

```markdown
## Test Session: [Date]

**Tester:** [Name]
**Device:** [iOS/Android, Version]
**App Version:** [Version]

### Results:

| Scenario            | Status  | Notes                 |
| ------------------- | ------- | --------------------- |
| First-Time User     | ✅ Pass | Initial bonus granted |
| Earning Points      | ✅ Pass | Celebration appeared  |
| Points Dashboard    | ✅ Pass | All filters working   |
| Discount Redemption | ✅ Pass | Coupon received       |
| Navigation          | ✅ Pass | All paths working     |
| Real-Time Updates   | ✅ Pass | Socket connected      |
| Edge Cases          | ✅ Pass | Errors handled        |
| Performance         | ✅ Pass | No lag detected       |

### Issues Found:

- None

### Recommendations:

- Ready for production
```

---

**Status:** Ready for Testing  
**Estimated Time:** 30-45 minutes for full test suite  
**Priority:** HIGH (Core feature)  
**Date:** October 21, 2025
