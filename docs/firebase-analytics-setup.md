# Firebase Analytics Setup (Web + Mobile)

This repository now includes Firebase analytics integration points for:
- `web-saas` (Next.js App Router)
- `mobile` (Expo + `@react-native-firebase/analytics`)

## What Is Already Implemented

### Web (`web-saas`)
- Firebase SDK analytics wrapper:
  - `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/src/lib/analytics/firebaseAnalyticsService.ts`
- Auth/session linkage:
  - Sets `user_id` when signed in and clears on logout.
  - Sets user properties (`plan`, `roles`).
- Route/screen tracking:
  - Emits `web_screen_view` and `page_view` from App Router transitions.
- Environment template:
  - `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/.env.example`

### Mobile (`mobile`)
- Existing analytics wrapper remains in place:
  - `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/services/firebaseAnalyticsService.ts`
- Expo config now supports Firebase native files from env:
  - `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/app.config.js`
- Firebase config paths added to env template:
  - `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/.env.example`

## Required From Your Side

### 1) Create Firebase Project + Analytics
1. Create/open project in Firebase Console.
2. Enable Google Analytics for the project.

### 2) Register Apps in Firebase
1. Register Web app for `web-saas`.
2. Register Android app for mobile.
3. Register iOS app for mobile.

The Android package name and iOS bundle identifier in Firebase must match the mobile build config you use.
If they are not already defined in Expo config, set them in mobile `.env`:
- `IOS_BUNDLE_IDENTIFIER=com.yourcompany.spokio`
- `ANDROID_PACKAGE_NAME=com.yourcompany.spokio`

### 3) Provide Web Firebase Config (`web-saas`)
Create `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/.env.local` from `.env.example` and fill:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Optional:
- `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true|false`

### 4) Provide Mobile Firebase Files (`mobile`)
Download from Firebase Console:
- Android: `google-services.json`
- iOS: `GoogleService-Info.plist`

Place them in:
- `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/google-services.json`
- `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/GoogleService-Info.plist`

Then set in `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/.env`:
- `GOOGLE_SERVICES_JSON=./google-services.json`
- `GOOGLE_SERVICE_INFO_PLIST=./GoogleService-Info.plist`

## Run and Verify

### Web
1. `cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas`
2. `npm install`
3. `npm run dev`
4. Sign in, navigate pages, then verify events in Firebase/GA4 DebugView.

### Mobile
Important: Expo Go does not run RN Firebase native analytics. Use a development build / EAS build.

1. `cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile`
2. `npm install`
3. Build/run with native modules (dev client or EAS).
4. Trigger events (app launch, sign-in flow) and verify in DebugView.

## Troubleshooting

- No web events:
  - Confirm `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set.
  - Confirm `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED` is not `false`.
- Mobile logs `noop mode`:
  - Firebase files missing/invalid, or running in Expo Go.
- Events delayed:
  - Use GA4 DebugView for near-real-time validation.
