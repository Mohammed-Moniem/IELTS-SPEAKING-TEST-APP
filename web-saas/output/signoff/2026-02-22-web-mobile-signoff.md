# Web + Mobile Signoff Matrix (2026-02-22)

## Scope
- Web staging signoff (typecheck, build, E2E, real-backend E2E, accessibility)
- Mobile automated gate (typecheck + Jest smoke tests)
- Mobile runtime smoke (device availability + platform bundle exports)

## Results

| Area | Gate | Command | Result |
|---|---|---|---|
| Web | Typecheck | `npm run typecheck` (in `web-saas`) | PASS |
| Web | Production build | `npm run build` (in `web-saas`) | PASS |
| Web | Cross-browser E2E | `npm run test:e2e` (in `web-saas`) | PASS (`75 passed`) |
| Web | Real-backend E2E | `npm run test:e2e:real` (in `web-saas`) | PASS (`2 passed`) |
| Web | Accessibility | `npm run test:a11y` (in `web-saas`) | PASS (`6 passed`) |
| Mobile | Automated gate | `npm run verify` (in `mobile`) | PASS (`typecheck` + `2 suites / 7 tests`) |
| Mobile | iOS bundle smoke | `npx expo export --platform ios --output-dir output/smoke-export-ios` | PASS |
| Mobile | Android bundle smoke | `npx expo export --platform android --output-dir output/smoke-export-android` | PASS |
| Mobile | iOS real-device availability | `xcrun xctrace list devices` | BLOCKED (no physical iPhone listed) |
| Mobile | Android real-device availability | `adb devices -l` | BLOCKED (`adb` not installed) |
| Mobile | Expo health checks | `npx expo-doctor` | PASS (`17/17` checks passed) |

## Mobile Expo Doctor Fixes Applied
1. Squared icon assets (`icon.png`, `adaptive-icon.png`) to satisfy schema.
2. Reworked dynamic config to merge incoming `config` values from `app.json`.
3. Migrated Sentry integration from `sentry-expo` to `@sentry/react-native`.
4. Removed unmaintained `react-native-camera` dependency (unused in source).
5. Applied SDK-compatible package upgrades and pinned `jest-expo` to `~54.0.17`.

## Added mobile test gate artifacts
- `mobile/jest.config.js`
- `mobile/jest.setup.ts`
- `mobile/src/auth/AuthContext.test.tsx`
- `mobile/src/utils/errors.test.ts`
- `mobile/package.json` scripts:
  - `typecheck`
  - `test`
  - `test:ci`
  - `verify`
  - `smoke:mobile`
