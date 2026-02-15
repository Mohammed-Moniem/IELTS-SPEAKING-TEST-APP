# Phone Number with Country Code - Implementation

## Overview

Enhanced the phone number field in ProfileScreen to include country code selection for international phone numbers.

## Changes Made

### 1. Country Codes Array

Added comprehensive list of 37 country codes with flag emojis:

```typescript
const COUNTRY_CODES = [
  { label: "🇦🇪 UAE (+971)", value: "+971" },
  { label: "🇸🇦 Saudi Arabia (+966)", value: "+966" },
  { label: "🇪🇬 Egypt (+20)", value: "+20" },
  // ... 34 more countries
];
```

**Included Regions:**

- **Middle East**: UAE, Saudi Arabia, Egypt, Jordan, Lebanon, Kuwait, Qatar, Bahrain, Oman, Palestine, Iraq, Yemen, Syria
- **Europe**: UK, Ireland, Germany, France, Netherlands, Sweden
- **North America**: USA, Canada
- **Oceania**: Australia, New Zealand
- **Asia**: India, Pakistan, Bangladesh, Turkey, Indonesia, Malaysia, Singapore, Philippines, Thailand, Vietnam, South Korea, Japan, China

### 2. Phone Number Parsing

Added helper function to parse existing phone numbers:

```typescript
const parsePhoneNumber = (phone: string) => {
  if (!phone) return { countryCode: "+971", phoneNumber: "" };

  // Extract country code if present
  if (phone.startsWith("+")) {
    const matchedCode = COUNTRY_CODES.find((cc) => phone.startsWith(cc.value));
    if (matchedCode) {
      return {
        countryCode: matchedCode.value,
        phoneNumber: phone.substring(matchedCode.value.length),
      };
    }
  }

  // Default to UAE if no country code
  return { countryCode: "+971", phoneNumber: phone };
};
```

**Features:**

- Automatically detects existing country codes in phone numbers
- Defaults to UAE (+971) for new entries
- Separates country code from phone number for editing

### 3. UI Layout

Updated phone input to use side-by-side layout:

```
┌────────────────────────────────────────┐
│ Phone Number                           │
├──────────────────┬─────────────────────┤
│ 🇦🇪 UAE (+971) ▼ │ 543043329          │
│     (40% width)  │    (60% width)      │
└──────────────────┴─────────────────────┘
```

**Layout Details:**

- Country code dropdown: 40% width
- Phone number input: 60% width
- Gap between fields: standard spacing
- Both fields aligned horizontally

### 4. Data Storage

Phone numbers are now stored in the database with full international format:

**Examples:**

- UAE: `+971543043329`
- USA: `+15551234567`
- UK: `+447911123456`
- Saudi Arabia: `+966501234567`

**Before:** `543043329` (ambiguous)
**After:** `+971543043329` (clear, international)

### 5. State Management

```typescript
// Separate state for country code
const [countryCode, setCountryCode] = useState("+971");

// Phone number without country code
const [profileForm, setProfileForm] = useState({
  phone: "543043329", // Just the number
  // ... other fields
});

// Combine when saving
phone: countryCode + profileForm.phone; // "+971543043329"
```

### 6. User Experience

**Editing Existing Phone:**

1. System detects country code in `+971543043329`
2. Splits to: Country Code = `+971`, Phone = `543043329`
3. User sees: Dropdown showing "🇦🇪 UAE (+971)" and input showing "543043329"
4. User can change either field independently
5. On save: Combines to `+971543043329`

**New Phone Entry:**

1. Country code defaults to `+971` (UAE)
2. User can select different country from dropdown
3. User enters phone number without country code
4. System combines on save

## Code Changes

### ProfileScreen.tsx

**Added:**

- `COUNTRY_CODES` constant (37 countries)
- `parsePhoneNumber()` helper function
- `countryCode` state variable
- Phone container layout with flexbox
- Country code dropdown component
- Combined save logic

**Modified:**

- Phone input split into two fields
- Save button now combines country code + phone
- useEffect parses existing phone numbers
- Styles added for phone layout

**Removed:**

- Single phone input field

## Styles Added

```typescript
phoneContainer: {
  flexDirection: "row",
  gap: spacing.md,
  marginBottom: spacing.md,
},
countryCodeContainer: {
  flex: 0.4,  // 40% width
},
phoneInputContainer: {
  flex: 0.6,  // 60% width
},
```

## Benefits

✅ **International Support**: Users from any country can enter their number correctly
✅ **Clear Format**: Phone numbers stored with country code (+971543043329)
✅ **Easy Selection**: Beautiful dropdown with country flags and names
✅ **Automatic Parsing**: Existing numbers split automatically
✅ **Future-Proof**: Numbers ready for SMS, WhatsApp, calling features
✅ **Better UX**: Users don't have to remember their country code
✅ **Validation Ready**: Format makes validation easier

## Future Enhancements

- [ ] Add phone number validation (length, format)
- [ ] Auto-format as user types (e.g., +971 54 304 3329)
- [ ] Add search in country code dropdown
- [ ] Detect country code from user's location
- [ ] Add popular countries to top of list
- [ ] Show example number format for selected country

## Testing Checklist

- [ ] New user: Select country code, enter phone, save
- [ ] Existing user with code: Phone splits correctly
- [ ] Existing user without code: Defaults to +971
- [ ] Change country code, verify save works
- [ ] Verify saved format in database: +[code][number]
- [ ] Test with various country codes
- [ ] Test dropdown scrolling (37 countries)
- [ ] Verify country code persists after save
- [ ] Test numeric keyboard appears for phone input

## Example Scenarios

**Scenario 1: UAE User (New)**

```
1. Opens profile, sees country code defaulted to "🇦🇪 UAE (+971)"
2. Enters "543043329" in phone field
3. Saves
4. Database stores: "+971543043329"
```

**Scenario 2: UK User (Changing)**

```
1. Opens profile
2. Taps country code dropdown
3. Selects "🇬🇧 UK (+44)"
4. Enters "7911123456"
5. Saves
6. Database stores: "+447911123456"
```

**Scenario 3: Existing User**

```
1. Database has: "+971543043329"
2. Opens profile
3. Sees: Country code = "🇦🇪 UAE (+971)", Phone = "543043329"
4. Can edit either field
5. Save combines them back
```

---

**Status**: ✅ Complete
**Updated**: October 18, 2025
**Impact**: High - Essential for international user base
