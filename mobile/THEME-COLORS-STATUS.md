# 🎨 Theme Colors - Already Integrated Throughout App

## ✅ Current Status

The Spokio purple theme is **already being used** throughout the entire mobile app via the centralized `tokens.ts` system.

---

## Theme System Architecture

### Central Definition

**File:** `mobile/src/theme/tokens.ts`

All colors are defined once and imported everywhere:

```typescript
export const colors = {
  // Primary (Purple - Spokio Brand)
  primary: "#7C3AED", // Main brand purple
  primaryHover: "#9333EA", // Hover/pressed states
  primarySoft: "#F3E8FF", // Light purple backgrounds
  primaryStrong: "#6D28D9", // Dark purple accents

  // Secondary (Pink accent)
  secondary: "#EC4899",

  // Backgrounds
  background: "#FFFFFF",
  backgroundMuted: "#F8F7FB", // Subtle purple-tinted gray
  surface: "#FFFFFF",

  // Text
  textPrimary: "#221E2B", // Dark purple-tinted text
  textSecondary: "#4A4358",
  textMuted: "#7A7090",

  // Borders
  border: "rgba(124, 58, 237, 0.15)", // 15% purple
  borderMuted: "#E4E1F0",

  // ... more colors
};
```

---

## Where Theme Colors Are Used

### ✅ All Screens Import & Use Theme

Every screen in the app imports colors from tokens:

```typescript
import { colors, spacing, radii } from "../../theme/tokens";
```

### Examples of Current Usage:

#### 1. **Navigation & Headers**

- `AppNavigator.tsx` - Tab bar, header backgrounds
- `CustomTabBar.tsx` - Active tab highlighting (purple)
- `ProfileMenu.tsx` - Menu background, text colors

#### 2. **Authentication Screens**

- `LoginScreen.tsx` - Buttons use `colors.primary`
- `RegisterScreen.tsx` - Form inputs, error states
- Title text uses `colors.textPrimary`

#### 3. **Main Screens**

- `HomeScreen.tsx` - Cards, buttons, loading indicators
- `ProfileScreen.tsx` - Section backgrounds, switches
- `AnalyticsScreen.tsx` - Charts, cards, stats
- `SettingsScreen.tsx` - Toggle switches, list items

#### 4. **Practice & Test Screens**

- `PracticeScreen.tsx` - Topic cards, filters
- `VoiceTestScreen.tsx` - Recording UI, mic button
- `AuthenticFullTestV2.tsx` - Test UI, progress indicators
- `ResultsScreen.tsx` - Score displays, band colors

#### 5. **Social Features**

- `SocialNavigator.tsx` - Stack headers
- `ChatScreen.tsx` - Message bubbles, timestamps
- `LeaderboardScreen.tsx` - Rank badges, scores
- `AchievementsScreen.tsx` - Achievement cards

#### 6. **UI Components**

- `Button.tsx` - Primary, secondary, ghost variants
- `Card.tsx` - Surface backgrounds, shadows
- `Tag.tsx` - Status badges, labels
- `FormTextInput.tsx` - Input borders, focus states
- `EmptyState.tsx` - Icons, text colors

---

## How Colors Automatically Apply

When you updated `tokens.ts`, every component automatically received the new Spokio purple theme because they all import from the same source:

### Before (Old Theme):

```typescript
// Old tokens.ts
primary: blue.blue9,      // Generic blue
```

### After (Spokio Theme):

```typescript
// New tokens.ts
primary: "#7C3AED",       // Spokio purple
```

### Result:

All 50+ components that use `colors.primary` now show **Spokio purple** instead of blue! 🎉

---

## Color Mapping Examples

Here's how theme colors map to UI elements:

| Color Token              | Usage                               | Screens                       |
| ------------------------ | ----------------------------------- | ----------------------------- |
| `colors.primary`         | Buttons, active states, links       | All screens                   |
| `colors.primarySoft`     | Hover backgrounds, highlights       | Cards, lists                  |
| `colors.surface`         | Card backgrounds                    | Dashboard, profile, analytics |
| `colors.backgroundMuted` | Page backgrounds                    | Most screens                  |
| `colors.textPrimary`     | Main text content                   | Everywhere                    |
| `colors.textSecondary`   | Subtitles, descriptions             | Headers, cards                |
| `colors.textMuted`       | Hints, placeholders                 | Forms, captions               |
| `colors.border`          | Card outlines, dividers             | Lists, sections               |
| `colors.success`         | Success messages, positive feedback | Notifications, results        |
| `colors.danger`          | Error messages, warnings            | Forms, alerts                 |

---

## Special Color Applications

### 1. **Loading States**

```typescript
<ActivityIndicator color={colors.primary} />
```

All loading spinners use Spokio purple.

### 2. **Navigation**

```typescript
// Active tab
backgroundColor: colors.primary,
// Inactive tab
color: colors.textMuted,
```

### 3. **Forms**

```typescript
// Focus state
borderColor: colors.primary,
// Error state
borderColor: colors.danger,
```

### 4. **Switches & Toggles**

```typescript
trackColor={{ false: colors.borderMuted, true: colors.primary }}
```

### 5. **Shadows**

```typescript
shadowColor: colors.primary,  // Purple glow on focused elements
```

---

## Component-Level Examples

### Button Component

```typescript
// mobile/src/components/Button.tsx
const variantStyles = {
  primary: {
    backgroundColor: colors.primary, // Purple button
    text: colors.textInverse, // White text
  },
  secondary: {
    backgroundColor: colors.primarySoft, // Light purple
    text: colors.primary, // Purple text
  },
  ghost: {
    backgroundColor: "transparent",
    text: colors.primary, // Purple text
  },
};
```

### Card Component

```typescript
// mobile/src/components/Card.tsx
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, // White
    borderRadius: radii.xxl,
    ...shadows.card, // Subtle shadow
  },
});
```

### Tag Component

```typescript
// mobile/src/components/Tag.tsx
const toneStyles = {
  default: {
    background: colors.borderMuted,
    text: colors.textPrimary,
  },
  info: {
    background: colors.infoSoft, // Light purple
    text: colors.info, // Purple text
  },
};
```

---

## Screens Using Purple Theme

All of these screens automatically display Spokio purple:

### Authentication Flow

- ✅ Login screen (buttons, links)
- ✅ Register screen (buttons, password strength)
- ✅ **Onboarding splash screens (NEW!)** - Purple gradients, orbs, tiles

### Main App

- ✅ Home dashboard (buttons, cards)
- ✅ Practice sessions (UI controls)
- ✅ Voice test (mic button, recording UI)
- ✅ Results & analytics (charts, stats)
- ✅ Profile (switches, sections)
- ✅ Settings (toggles, list items)

### Social Features

- ✅ Friends list (action buttons)
- ✅ Chat (timestamps, status indicators)
- ✅ Leaderboard (rank badges)
- ✅ Achievements (unlock notifications)

### Navigation

- ✅ Bottom tab bar (active state)
- ✅ Stack headers (icons, buttons)
- ✅ Profile menu (dropdown items)

---

## No Additional Work Needed! ✅

The theme colors are **already integrated** throughout the entire app. Every component that needs color uses the centralized `tokens.ts` system.

### What This Means:

1. **Consistent branding** - Purple theme appears everywhere automatically
2. **Easy maintenance** - Change colors in one place (`tokens.ts`), updates everywhere
3. **Scalable** - New components just import from tokens
4. **Dark mode ready** - Can add dark theme variants in tokens.ts later

---

## Testing the Theme

To verify the purple theme is working:

1. **Start the app:**

   ```bash
   cd mobile
   npx expo start
   ```

2. **Check these screens:**

   - Login screen → Purple "Sign in" button
   - Register screen → Purple "Create account" button
   - Home screen → Purple "Start practice" button
   - Profile screen → Purple switches when enabled
   - Any loading state → Purple spinner

3. **Navigate around:**
   - Active tab in bottom navigation → Purple background
   - Touch any button → Purple press state
   - Focus any input → Purple border

Everything should display in **Spokio purple** (#7C3AED)! 🟣

---

## Future Customization

If you need to adjust colors later:

1. Edit `mobile/src/theme/tokens.ts`
2. Change hex values
3. Restart dev server
4. All screens update automatically

No need to edit 50+ component files individually! 🎉

---

## Summary

✅ **Theme colors are already integrated app-wide**
✅ **All UI components use the centralized color system**
✅ **Spokio purple (#7C3AED) appears throughout the app**
✅ **No additional color work needed - just add logo assets!**

Focus on adding the logo PNG files (see `LOGO-ASSETS-GUIDE.md`), and your rebrand will be complete!
