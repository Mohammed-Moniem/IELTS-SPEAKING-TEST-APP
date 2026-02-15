# Referral System End-to-End Testing Checklist

This guide walks you through validating the complete referrals experience across web, mobile, and backend flows.

## 1. Generate a Referral Link

1. Log in with a referrer account.
2. Open **Social → Referrals**.
3. Confirm the screen now shows:
   - A refreshed hero card with the referral code.
   - A **Share link** button that copies a URL in the format `https://<domain>/referral/<CODE>` (the domain is controlled by the `REFERRAL_BASE_URL` env var on the backend).

> _Tip:_ Copy the referral link for the next steps.

## 2. Test the Web Landing Page

1. Paste the referral URL into any desktop or mobile browser.
2. Verify the landing page renders with:
   - Referrer name or username.
   - The referral code.
   - Bonus description for referrer and referee.
   - Buttons:
     - `Open in the app` (deep link)
     - `Download on the App Store`
     - `Get it on Google Play`
3. Try an invalid URL such as `/referral/XXXX` and confirm a friendly error page appears.

## 3. Test Deep Links (App Installed)

1. On a device with the mobile app installed, tap the referral link (from Mail, Notes, etc.).
2. Expected behaviour:
   - The app opens automatically.
   - You land on the **Register** screen (if not authenticated).
   - The referral code field is pre-filled.
   - The password hint explains the required complexity.

> _Note:_ Deep links support both `ieltsspeaking://register?ref=CODE` and `https://<domain>/referral/CODE`.

## 4. Register Using the Referral

1. Complete registration with a new email and strong password.
2. Confirm:
   - Registration succeeds (no validation errors).
   - Both referrer and referee receive the expected points / practice session rewards.
   - Referral stats update (total and successful counts).

## 5. Analytics & Logging

During the flow, ensure logs capture:

- Referral landing page hits (`Referral code clicked` log entry).
- Any invalid code attempts (400 response with `Invalid referral code`).

## 6. Regression Checks

- Logging in without a referral still works.
- Legacy links (`/register?ref=CODE`) redirect to the new landing page.
- Sharing the link from the in-app Share button returns the new URL.

---

**Quick Summary**

- ✅ Landing page served at `/referral/:code`
- ✅ Deep link opens app and pre-fills the referral code
- ✅ Registration honours referral codes and rewards both users
- ✅ Clear error handling for invalid codes
- ✅ Documentation for QA to reproduce end-to-end

You can now hand this checklist to QA or use it during manual smoke tests. Happy testing!
