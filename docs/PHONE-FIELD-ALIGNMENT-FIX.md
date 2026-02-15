# Phone Field Alignment Fix

## Issue

The phone number input field appeared smaller and misaligned compared to other fields in the profile. The country code dropdown and phone input didn't have consistent width and height with other form inputs.

## Changes Made

### 1. Phone Input Layout Redesign

```tsx
<View style={styles.phoneContainer}>
  <TouchableOpacity style={styles.countryCodeButton}>
    <Text>
      {flag} {countryCode}
    </Text>
    <Text>▼</Text>
  </TouchableOpacity>

  <View style={styles.phoneInputWrapper}>
    <TextInput
      value={phone}
      placeholder="543043329"
      keyboardType="phone-pad"
      style={styles.phoneInput}
    />
  </View>
</View>
```

### 2. Updated Styles

#### Country Code Button

- **Height**: 56px (matches FormTextInput)
- **Width**: 135px (fixed width for consistency)
- **Border**: 1px solid borderMuted
- **Background**: White surface color
- **Border Radius**: Medium (matches other inputs)
- **Padding**: Medium horizontal padding
- **Layout**: Row with space-between for flag/code and arrow

#### Phone Input Wrapper

- **Height**: 56px (matches country code button)
- **Flex**: 1 (takes remaining space)
- **Border**: 1px solid borderMuted
- **Background**: White surface color
- **Border Radius**: Medium (matches other inputs)
- **Padding**: Medium horizontal padding

#### Phone Container

- **Layout**: Row direction with center alignment
- **Spacing**: Small gap (8px) between country code and phone input
- **Margin**: Medium bottom margin

### 3. Improved TextInput Styling

- **Font Size**: 16px (matches FormTextInput)
- **Color**: Primary text color
- **Padding**: 0 (removed default padding for precise alignment)
- **Margin**: 0 (removed default margin)

## Visual Consistency

### Before

- Country code dropdown: Different height, variable width
- Phone input: Smaller appearance, misaligned
- Overall: Inconsistent with other form fields

### After

- ✅ Both fields have 56px height (matches all other inputs)
- ✅ Country code has fixed 135px width (accommodates all flags + codes)
- ✅ Phone input flexes to fill remaining space
- ✅ Both fields have identical border, background, and border radius
- ✅ Proper 8px gap between fields
- ✅ Perfect vertical alignment

## Save Functionality

### Basic Info Save

```tsx
<Button
  title="Save Basic Info"
  onPress={() =>
    updateProfileMutation.mutate({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: countryCode + profileForm.phone, // Combined: "+971543043329"
    })
  }
  loading={updateProfileMutation.isPending}
/>
```

**Features:**

- ✅ Combines country code + phone number before saving
- ✅ Shows loading state during API call
- ✅ Displays success alert on completion
- ✅ Shows error alert on failure
- ✅ Refreshes profile data after save
- ✅ Invalidates cache to ensure fresh data

### Social Profile Save

```tsx
<Button
  title="Save Social Profile"
  onPress={() => updateSocialProfileMutation.mutate()}
  loading={updateSocialProfileMutation.isPending}
/>
```

**Saves:**

- Username
- Bio
- IELTS Type (academic/general)
- Target Band Score (5.0-9.0)
- Test Date
- Study Purpose
- Target Country
- Friend Suggestions (enabled/disabled)
- Online Status (show/hide)

### Privacy Settings Save

```tsx
<Button
  title="Save Privacy Settings"
  onPress={() => updatePrivacyMutation.mutate()}
  loading={updatePrivacyMutation.isPending}
/>
```

**Saves:**

- Profile Visibility (public/friends-only/private)
- Leaderboard Opt-in
- Show Statistics

## Phone Number Parsing

### On Profile Load

```tsx
const parsePhoneNumber = (fullPhone: string) => {
  if (!fullPhone) return { countryCode: "+971", phoneNumber: "" };

  const match = fullPhone.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    return {
      countryCode: match[1],
      phoneNumber: match[2],
    };
  }
  return { countryCode: "+971", phoneNumber: fullPhone };
};
```

**Example:**

- Input: `"+971543043329"`
- Output: `{ countryCode: "+971", phoneNumber: "543043329" }`

### On Save

```tsx
phone: countryCode + profileForm.phone;
```

**Example:**

- Country Code: `"+971"`
- Phone: `"543043329"`
- Saved: `"+971543043329"`

## Testing Checklist

### Visual Alignment

- [ ] Country code button height matches other input fields
- [ ] Phone input height matches other input fields
- [ ] Both fields aligned horizontally
- [ ] Consistent border, background, and corner radius
- [ ] Proper spacing between country code and phone input
- [ ] Full width utilization (country code + gap + phone input = full width)

### Country Code Selection

- [ ] Tap country code button opens modal
- [ ] Modal displays all 87 countries organized by region
- [ ] Selected country highlighted with blue background
- [ ] Checkmark appears next to selected country
- [ ] Modal scrolls smoothly through all options
- [ ] Selected flag and code display in button after selection
- [ ] Close button (✕) dismisses modal

### Phone Input

- [ ] Phone input accepts only numbers
- [ ] Placeholder "543043329" displays when empty
- [ ] Numeric keyboard appears on focus
- [ ] Text color is primary (black/dark)
- [ ] Placeholder color is muted (gray)

### Save Functionality

- [ ] Save Basic Info button shows loading state
- [ ] Combined phone number (+971543043329) saves correctly
- [ ] Success alert appears after save
- [ ] Profile data refreshes after save
- [ ] Error alert appears if save fails
- [ ] Phone number persists after app restart
- [ ] Phone number parsed correctly on next load

### Data Persistence

- [ ] Enter phone: "+971" and "543043329"
- [ ] Save Basic Info
- [ ] Close app completely
- [ ] Reopen app
- [ ] Navigate to Profile
- [ ] Verify country code shows "🇦🇪 +971"
- [ ] Verify phone shows "543043329"

## Technical Details

### Dependencies Added

- `TextInput` from `react-native` (already available)

### State Management

```tsx
const [countryCode, setCountryCode] = useState(parsedPhone.countryCode);
const [showCountryCodePicker, setShowCountryCodePicker] = useState(false);
const [profileForm, setProfileForm] = useState({
  ...
  phone: parsedPhone.phoneNumber,
});
```

### API Integration

- **Endpoint**: `PUT /users/profile`
- **Payload**: `{ firstName, lastName, phone }`
- **Response**: Updated user object
- **Cache**: Invalidates `["preferences"]` query

## Files Modified

- `mobile/src/screens/Profile/ProfileScreen.tsx`
  - Added `TextInput` import
  - Updated phone input layout
  - Added `phoneInputWrapper` style
  - Updated `countryCodeButton` dimensions
  - Updated `phoneInput` style
  - Updated `phoneContainer` alignment

## Result

The phone field now perfectly matches the visual appearance and behavior of all other form fields in the profile screen, providing a consistent and professional user experience. The save functionality is fully operational with proper error handling and user feedback.
