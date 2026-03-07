# Web SaaS UX Audit Summary

Date: 2026-03-06
Surface: Spokio web SaaS
Scope: Marketing and learner surfaces only

## Scope

This review covers:

- Marketing routes: home, pricing, login, register, features
- Learner routes: dashboard, speaking, writing, tests, progress, billing, settings
- Shared layout primitives and interaction patterns

This review does not deeply audit:

- Mobile app screens
- Admin operations surfaces
- Production analytics, session recordings, or support-ticket evidence

## Assumptions

- The main business goals are registration, first-session activation, repeat practice, and paid conversion.
- The learner app should support both desktop and mobile web, not just large screens.
- Internal environment copy such as "test-mode" and "UI only" should not reach learner-facing production surfaces.

## Success Criteria

- More visitors move from marketing pages to registration.
- More new learners complete a first meaningful practice session within one visit.
- Returning learners can see one clear "next best action" within 5 seconds of landing.
- Billing and settings feel trustworthy and outcome-oriented rather than operational or internal.
- Serious accessibility issues are reduced to zero on critical routes.

## Evidence Used

- Existing Playwright screenshots in `web-saas/output/playwright/screenshots/all-pages/`
- Route and shell code in `web-saas/app/` and `web-saas/src/components/`
- Accessibility run from `cd web-saas && npm run test:a11y`

## Top Risks

1. The learner shell is desktop-only and likely breaks badly on small screens.
2. The marketing header hides navigation below `md` with no alternate mobile menu.
3. Accessibility debt is already visible in automated testing, not just subjective review.
4. Learner-facing copy leaks internal system language and reduces trust at key monetization moments.
5. The product communicates breadth well, but it does not yet guide users to the single best next step.

## Recommendation Summary

1. Fix layout fundamentals first: responsive navigation, mobile learner shell, keyboard-safe auth fields, and contrast.
2. Remove internal language from learner-facing pages and rewrite around user outcomes.
3. Rework the dashboard and module pages around one dominant daily action plus one recovery action.
4. Compress the marketing funnel with stronger proof, simpler plan guidance, and sharper upgrade framing.
5. Make progress, billing, and settings more action-oriented so they help learners move forward instead of just showing state.

## Confidence

- High confidence: layout, accessibility, copy trust, and information hierarchy findings
- Medium confidence: conversion recommendations, because no analytics or user interviews were provided
