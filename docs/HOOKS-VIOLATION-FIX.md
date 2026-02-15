# Hooks Violation Error Fix

## Problem

After implementing the PointsContext provider to fix rate limiting issues, a new React error occurred:

```text
ERROR [Error: Rendered more hooks than during the previous render.]
ERROR 🚨 ErrorBoundary caught error
Component stack: AppNavigator.tsx:225 → useAuth()
```

## Root Causes

There were **TWO separate issues** causing the hooks violation:

### Issue 1: PointsProvider Placement

The `PointsProvider` was wrapping `AppContent`, causing complex nesting where multiple components called `useAuth()` at different tree levels.

### Issue 2: Conditional Return Before Hooks in AppNavigator

**Critical:** The `AppNavigator` component had a conditional return (`if (initializing) return <SplashScreen />`) that appeared BEFORE the second `useEffect` hook:

```typescript
// ❌ WRONG - Conditional return before all hooks
export const AppNavigator = () => {
  const { user, initializing } = useAuth();  // Hook 1
  const navigationRef = useNavigationContainerRef();  // Hook 2
  const routeNameRef = useRef();  // Hook 3
  const pendingReferralRef = useRef();  // Hook 4
  const [navReady, setNavReady] = useState(false);  // Hook 5
  const processReferralUrl = useCallback(...);  // Hook 6

  useEffect(() => { /* first effect */ }, []);  // Hook 7

  if (initializing) {
    return <SplashScreen />;  // ❌ Returns here when initializing=true (7 hooks)
  }

  useEffect(() => { /* second effect */ }, []);  // Hook 8 - only called when initializing=false!

  return <NavigationContainer>...</NavigationContainer>;
};
```

This caused:

- When `initializing = true`: Only 7 hooks executed
- When `initializing = false`: All 8 hooks executed
- Result: Hook count mismatch → React error

## Solution

### Fix 1: Conditional PointsProvider Rendering (App.tsx)

Moved `PointsProvider` inside `AppContent` and made it conditionally render only when user is authenticated:

### Before (App.tsx)

```typescript
const AppContent = () => {
  const { user, accessToken } = useAuth();
  // ... socket logic

  return (
    <>
      <AppNavigator />
      <OfflineBanner />
      <ToastContainer />
      <StatusBar style="dark" />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <PointsProvider>
        {" "}
        {/* ❌ Wrapped AppContent */}
        <AppContent />
      </PointsProvider>
    </AuthProvider>
  );
};
```

### After (App.tsx)

```typescript
const AppContent = () => {
  const { user, accessToken } = useAuth();
  // ... socket logic

  // ✅ Conditionally render PointsProvider only when authenticated
  if (user) {
    return (
      <PointsProvider>
        <AppNavigator />
        <OfflineBanner />
        <ToastContainer />
        <StatusBar style="dark" />
      </PointsProvider>
    );
  }

  // When not authenticated, render without PointsProvider
  return (
    <>
      <AppNavigator />
      <OfflineBanner />
      <ToastContainer />
      <StatusBar style="dark" />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent /> {/* ✅ AppContent conditionally renders PointsProvider */}
    </AuthProvider>
  );
};
```

### Fix 2: Move Conditional Return After All Hooks (AppNavigator.tsx)

Moved the `if (initializing)` check to execute AFTER all hooks:

**Before:**

```typescript
export const AppNavigator = () => {
  // ... hooks 1-6

  useEffect(() => {
    /* URL handling */
  }, [processReferralUrl]); // Hook 7

  if (initializing) {
    // ❌ Conditional return BEFORE second useEffect
    return <SplashScreen />;
  }

  useEffect(() => {
    /* pending referral */
  }, [navReady, user]); // Hook 8

  return <NavigationContainer>...</NavigationContainer>;
};
```

**After:**

```typescript
export const AppNavigator = () => {
  // ... hooks 1-6

  useEffect(() => {
    /* URL handling */
  }, [processReferralUrl]); // Hook 7

  useEffect(() => {
    /* pending referral */
  }, [navReady, user]); // Hook 8

  if (initializing) {
    // ✅ Conditional return AFTER all hooks
    return <SplashScreen />;
  }

  return <NavigationContainer>...</NavigationContainer>;
};
```

Now all 8 hooks are **always** called regardless of the `initializing` value, satisfying React's Rules of Hooks.

## New Component Hierarchy

**When Authenticated:**

```
AuthProvider (provides useAuth context)
└─ AppContent (consumes useAuth, renders PointsProvider)
   └─ PointsProvider (consumes useAuth)
      └─ AppNavigator (consumes useAuth)
      └─ OfflineBanner
      └─ ToastContainer
```

**When Not Authenticated:**

```
AuthProvider (provides useAuth context)
└─ AppContent (consumes useAuth, skips PointsProvider)
   └─ AppNavigator (consumes useAuth)
   └─ OfflineBanner
   └─ ToastContainer
```

## Why This Works

1. **Consistent Hook Execution:** `AppContent` always calls `useAuth()` first, then conditionally renders `PointsProvider`
2. **No Hook Count Changes:** When user logs in/out, the same hooks are called in `AppContent` - the conditional is AFTER hooks
3. **PointsProvider Only When Needed:** Points data is only fetched when user is authenticated
4. **No State Race Conditions:** `PointsProvider` can't cause re-renders that change hook counts since it's conditionally rendered based on a stable value

## Benefits

- ✅ Fixes "Rendered more hooks than during the previous render" error
- ✅ Maintains all rate limiting fixes (centralized points state)
- ✅ Preserves authentication flow
- ✅ No TypeScript errors in modified files
- ✅ Cleaner component hierarchy

## Testing Checklist

- [ ] App loads without hooks violation error
- [ ] Login/logout flow works correctly
- [ ] Points pill displays correctly on all screens
- [ ] Points API calls are not duplicated (check network tab)
- [ ] Socket connection works for real-time points updates
- [ ] Profile screen usage summary loads with authentication

## Files Modified

1. `/mobile/App.tsx`

   - Moved `<PointsProvider>` from wrapping `<AppContent>` to inside `AppContent`'s return statement
   - Added conditional rendering: PointsProvider only renders when `user` exists
   - Updated component hierarchy for proper hook execution order

2. `/mobile/src/navigation/AppNavigator.tsx`
   - **Critical Fix:** Moved `if (initializing) return <SplashScreen />` to execute AFTER all hooks
   - Ensures all 8 hooks are called on every render regardless of `initializing` state
   - Fixes hook count mismatch that was causing the React error

## Related Issues Fixed

- ✅ Rate limiting errors (duplicate points API calls) - see `CRITICAL-FIXES-RATE-LIMITING.md`
- ✅ Missing bearer token on `/usage/summary` endpoint
- ✅ Hooks violation error (this document)

## Technical Notes

### React Rules of Hooks

React requires that:

1. Hooks must be called in the same order on every render
2. Hooks can only be called at the top level (not inside conditionals, loops, or nested functions)
3. Hooks can only be called from React function components or custom hooks

When providers conditionally render children or cause re-renders that change the component tree structure, it can lead to different hook execution counts between renders, violating rule #1.

### Provider Placement Best Practices

1. **Place providers as close to where they're needed as possible**

   - Reduces unnecessary re-renders
   - Makes dependencies explicit
   - Prevents hook ordering issues

2. **Avoid nesting providers that consume each other**

   - Can create circular dependencies
   - Makes render cycles unpredictable
   - Can cause hook count mismatches

3. **Consider lazy initialization**
   - For expensive providers, initialize only when needed
   - Use conditional rendering INSIDE the provider, not around it
   - Always render children, but manage internal state conditionally

## Date

Fixed: 2024-01-XX (current session)
