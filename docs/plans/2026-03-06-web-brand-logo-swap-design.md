# Web Brand Logo Swap Design

## Goal

Replace the placeholder Spokio text lockup in the web SaaS shells with the actual logo sourced from the mobile app assets.

## Source Of Truth

- Primary source: `mobile/assets/logo.png`
- The mobile logo file is the approved brand asset, but it is packaged on a square canvas with excess transparent padding for app usage.

## Approach

1. Derive a web-safe trimmed asset from `mobile/assets/logo.png` into `web-saas/public/brand/`.
2. Add a shared `BrandLogo` component in the web app using `next/image`.
3. Replace placeholder branding in:
   - `web-saas/src/components/layout/MarketingShell.tsx`
   - `web-saas/src/components/layout/LearnerShell.tsx`
4. Remove the extra placeholder tagline from the marketing shell brand lockup so the header uses the real logo alone.

## Constraints

- Do not change navigation behavior or auth flows.
- Keep dark mode and responsive layouts intact.
- Avoid introducing layout shift by giving the logo explicit dimensions.

## Testing

- Add Playwright coverage to assert the real brand image appears in marketing navigation and the learner mobile drawer.
- Run targeted Playwright specs and `npm run typecheck`.
