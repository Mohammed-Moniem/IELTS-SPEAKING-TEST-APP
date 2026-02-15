# 📍 Logo Assets - Where to Add Files

## Required Logo Files

You need to add the following logo assets to complete the Spokio rebrand:

### 1. **Logo PNG (for splash screens)**

**Path:** `mobile/assets/logo.png`

- **Size:** 1024×1024 pixels (or larger, will be scaled down)
- **Format:** PNG with transparency
- **Usage:** Used in splash screen onboarding flow (SplashScreen1)
- **Current Reference:** `SplashScreens.tsx` line 203:
  ```tsx
  source={logoSource ?? require('../../../assets/logo.png')}
  ```

### 2. **App Icon**

**Path:** `mobile/assets/icon.png`

- **Size:** 1024×1024 pixels
- **Format:** PNG
- **Usage:** iOS/Android app icon
- **Note:** Should have some padding (safe area) around the logo
- **Background:** Can be transparent or use brand purple (#7C3AED)

### 3. **Adaptive Icon (Android)**

**Path:** `mobile/assets/adaptive-icon.png`

- **Size:** 1024×1024 pixels
- **Format:** PNG with transparency
- **Usage:** Android adaptive icon foreground layer
- **Background:** Transparent (background color is set to #7C3AED in app.json)
- **Note:** Center content within safe zone (66% of canvas)

### 4. **Splash Icon**

**Path:** `mobile/assets/splash-icon.png`

- **Size:** 2048×2048 pixels (recommended for high DPI screens)
- **Format:** PNG
- **Usage:** Shown on app launch splash screen (before React Native loads)
- **Background:** Transparent or white
- **Note:** This is the first thing users see when launching the app

### 5. **Favicon (Web)**

**Path:** `mobile/assets/favicon.png`

- **Size:** 192×192 pixels (or 512×512 for high res)
- **Format:** PNG
- **Usage:** Browser tab icon when running as PWA or web
- **Background:** Transparent or brand color

### 6. **Logo SVG (Optional)**

**Path:** `mobile/assets/logo.svg`

- **Format:** SVG
- **Usage:** Source file for generating PNGs, can be used in web version
- **Note:** Keep this for future updates/resizing

---

## Current Status

### ✅ Already Configured

- Theme colors updated to Spokio purple (#7C3AED)
- App name changed to "Spokio"
- Splash screen background color set to #7C3AED
- Adaptive icon background set to #7C3AED
- SplashScreens component created with animations

### ⏳ Pending (Your Action Required)

- [ ] Add `logo.png` (1024×1024) - **PRIORITY 1** (splash screens won't show without this)
- [ ] Add `icon.png` (1024×1024)
- [ ] Add `adaptive-icon.png` (1024×1024)
- [ ] Add `splash-icon.png` (2048×2048)
- [ ] Add `favicon.png` (192×192)
- [ ] (Optional) Add `logo.svg` for reference

---

## How to Generate PNGs from Your Logo

If you have the Spokio logo as SVG or other format:

### Method 1: Online Tools

1. Use [CloudConvert](https://cloudconvert.com/svg-to-png)
2. Upload your logo SVG
3. Set dimensions (1024×1024, 2048×2048, etc.)
4. Download and rename according to the paths above

### Method 2: Design Software

- **Figma:** Export as PNG at desired sizes
- **Sketch:** Export as PNG with @1x, @2x, @3x
- **Adobe Illustrator:** Export for Screens → PNG

### Method 3: Command Line (if you have ImageMagick)

```bash
# Convert SVG to different sizes
convert logo.svg -resize 1024x1024 icon.png
convert logo.svg -resize 1024x1024 adaptive-icon.png
convert logo.svg -resize 2048x2048 splash-icon.png
convert logo.svg -resize 192x192 favicon.png
```

---

## Testing After Adding Logos

Once you've added the logo files:

1. **Clear cache and restart:**

   ```bash
   cd mobile
   rm -rf .expo
   npx expo start --clear
   ```

2. **Test splash screens:**

   - Delete app from device/simulator
   - Fresh install to see onboarding flow

3. **Test app icon:**

   - Install on device
   - Check home screen icon appearance

4. **Test splash screen:**
   - Force quit app
   - Relaunch to see splash with logo

---

## Color Recommendations

### Logo Colors

- **Primary Purple:** #7C3AED (use this for main logo elements)
- **Accent Purple:** #9333EA (use for highlights/gradients)
- **White:** #FFFFFF (for text/contrast on purple backgrounds)

### Icon Backgrounds

- **iOS:** Can use transparency or white
- **Android Adaptive:** Use transparent PNG (background is already set to #7C3AED)
- **Splash:** Purple (#7C3AED) or white background work well

---

## Quick Reference: File Sizes

| File              | Size      | Path                              |
| ----------------- | --------- | --------------------------------- |
| logo.png          | 1024×1024 | `mobile/assets/logo.png`          |
| icon.png          | 1024×1024 | `mobile/assets/icon.png`          |
| adaptive-icon.png | 1024×1024 | `mobile/assets/adaptive-icon.png` |
| splash-icon.png   | 2048×2048 | `mobile/assets/splash-icon.png`   |
| favicon.png       | 192×192   | `mobile/assets/favicon.png`       |

---

## Need Help?

If you encounter issues:

1. Verify file paths exactly match the table above
2. Ensure PNG format (not JPG or JPEG)
3. Check file permissions (should be readable)
4. Restart Expo dev server after adding files
5. Clear build cache if assets don't update

---

## Onboarding Flow

The splash screens are now integrated:

- **Screen 1:** Spokio logo with sparkles, "Welcome to Spokio"
- **Screen 2:** AI-powered learning features with animated orb
- **Screen 3:** Achievement icons, "Achieve Your Goals"

The onboarding only shows once per user (tracked via AsyncStorage).
After completion, users see the login screen.
