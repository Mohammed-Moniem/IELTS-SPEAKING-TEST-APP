# Spokio Web SaaS - AI-Oriented Product Brief and Feature Contract (V1)

## 1) Why This Exists
Spokio Web exists to make IELTS prep complete, measurable, and operationally scalable.

1. Learners need one place for speaking, writing, reading, and listening.
2. Teams need one operational system for content, support, rollout, cost, and growth.
3. Mobile and web must share one identity, one entitlement model, and one progress graph.

## 2) What We Are Trying To Achieve First
This is the primary objective:

1. Deliver a full web SaaS experience (marketing + learner + admin) while keeping existing speaking behavior strictly intact.

This is what success looks like:

1. Marketing converts trust into registrations and paid upgrades.
2. Learners complete module workflows without manual workarounds.
3. Admin can operate content, roles, flags, campaigns, and partner programs safely.
4. Speaking endpoints continue to behave exactly as they do today for mobile/API clients.

## 3) How This Should Look to an AI Agent
If an AI system reads this doc for planning, coding, or design decisions, interpret it this way:

1. This is an extension of a live platform, not a greenfield rewrite.
2. Speaking contracts are immutable for behavior compatibility.
3. New module/admin capabilities are additive and flag-gated.
4. Prioritize task completion speed, trust, and operational safety over novelty.
5. Keep scope disciplined to IELTS SaaS core and avoid speculative social/gamification scope.
6. Preserve one design system with area-specific personalities:
   - marketing: premium academic editorial
   - learner: focused productivity SaaS
   - admin: operational control console

## 4) Non-Negotiable Constraints

1. No breaking change to speaking endpoints, request bodies, response fields, statuses, or semantics.
2. Authoritative speaking routes remain `/speech/*`, `/practice/*`, `/test-simulations/*`, `/topics/*`.
3. Web and mobile share user account, subscription, usage limits, and progress.
4. Feature flags remain mandatory for phased rollout and emergency rollback.
5. English-only UI for V1, with structure ready for future i18n.
6. Existing legacy/demo web folder remains untouched.

## 5) Product Surfaces and Purpose

### 5.1 Marketing Surface
Goal: educate, build trust, and convert.

1. Routes: `/`, `/pricing`, `/features`, `/about`, `/contact`, `/methodology`, `/editorial-policy`, `/ielts`, `/ielts/[slug]`, `/login`, `/register`.
2. Core features: value narrative, package comparison, trust pages, contact channels, SEO guide hub, and auth-aware CTAs.

### 5.2 Learner Surface
Goal: complete IELTS prep workflows with clear outcomes.

1. Routes: `/app/dashboard`, `/app/speaking`, `/app/writing`, `/app/reading`, `/app/listening`, `/app/tests`, `/app/progress`, `/app/billing`, `/app/settings`, `/app/partner`.
2. Detail routes: `/app/writing/history/[submissionId]`, `/app/reading/history/[attemptId]`, `/app/listening/history/[attemptId]`.

### 5.3 Admin Surface
Goal: run the platform safely and efficiently.

1. Routes: `/admin/overview`, `/admin/content`, `/admin/users`, `/admin/subscriptions`, `/admin/analytics`, `/admin/ai-cost`, `/admin/flags`, `/admin/notifications`, `/admin/partners`.
2. Core features: operations KPIs, content lifecycle, RBAC user support tools, AI cost controls, rollout controls, campaign controls, partner ops.

## 6) Literal Feature Contract

### 6.1 Auth, Session, and Runtime Gating

1. Email/password login and registration.
2. Optional registration fields: `phone`, `referralCode`, `partnerCode`.
3. Session model: `accessToken`, `refreshToken`, `user`.
4. Silent refresh and recovery on unauthorized responses.
5. Explicit expired-session UX and re-login path.
6. Route guards by auth state and role.
7. Feature-flag gating for writing, reading, listening, exams, and admin areas.
8. Bootstrap config endpoint for roles, plan, usage summary, and enabled flags.

### 6.2 Learner: Speaking (Compatibility-Protected)

1. Topic discovery from `/topics/practice`.
2. Practice session start with `/practice/sessions`.
3. Audio upload flow on practice sessions.
4. Practice completion flow.
5. Manual transcript fallback path.
6. Practice history retrieval and replay context.
7. Simulation start with `/test-simulations`.
8. Part progression UX and response capture.
9. Simulation completion and result retrieval.
10. Quick evaluator flow via `/speech/evaluate`.
11. Prompt TTS flow via `/speech/synthesize`.
12. Device/permission hardening: denied permission, missing device, recorder failure, retry handling.

### 6.3 Learner: Writing

1. Prompt generation via `/writing/tasks/generate`.
2. Track support for `academic` and `general`.
3. Task type support for `task1` and `task2`.
4. Timer and attempt lifecycle controls.
5. Draft autosave and recovery on return.
6. Word count and minimum word policy messaging.
7. Submission via `/writing/submissions`.
8. Submission detail and rubric feedback view.
9. History list and detail deep links.

### 6.4 Learner: Reading

1. Attempt start via `/reading/tests/start`.
2. Timer controls and attempt state handling.
3. Question navigator for rapid movement.
4. Review-before-submit stage.
5. Submit via `/reading/tests/:attemptId/submit`.
6. Attempt detail retrieval and explanation display.
7. History list and deep-link detail.

### 6.5 Learner: Listening

1. Attempt start via `/listening/tests/start`.
2. Timer controls and attempt state handling.
3. Question navigator and review-before-submit.
4. Submit via `/listening/tests/:attemptId/submit`.
5. Attempt detail retrieval and explanation display.
6. History list and deep-link detail.

### 6.6 Learner: Full Exam Orchestration

1. Start full exam via `/exams/full/start`.
2. Submit each section via `/exams/full/:examId/section/:module/submit`.
3. Complete via `/exams/full/:examId/complete`.
4. Retrieve final results via `/exams/full/:examId/results`.
5. Deterministic section progression.
6. Resume semantics after interruption.
7. Guided UX with no manual attempt ID entry.

### 6.7 Learner: Progress, Billing, Settings, Partner

1. Progress hub with cross-module history.
2. Filters for `track`, `from`, `to`.
3. Average-band summaries and deep links to attempt detail.
4. Billing with plan catalog, current subscription, usage summary, and cycle switching.
5. Checkout via Stripe and portal self-service.
6. Return-state handling for checkout success/cancel.
7. Settings with notification preferences and browser push controls.
8. Partner area with application, status, dashboard, codes, and payouts visibility.

### 6.8 Admin: Core Operational Features

1. Overview KPIs and quick actions.
2. Content management by module with typed, validation-aware forms.
3. User list and role mutation flows.
4. Subscription support list and status visibility.
5. Analytics dashboards for adoption and module performance.
6. AI cost visibility with filters by module/date/status.
7. Feature flag operations with high-impact confirmation gates.
8. Audit log listing and filters by actor/action/time window.
9. Notification campaign builder and delivery summaries.
10. Partner operations: partners, codes, targets, payout batches.

## 7) Where Module Topics and Content Come From
This is the content source model across modules:

1. Speaking topics and speaking-flow prompts come from existing speaking/topic services and banked backend data behind `/topics/*`, `/practice/*`, and `/test-simulations/*`.
2. Writing prompts come from hybrid sources: curated content bank plus AI generation through `/writing/tasks/generate`, with admin content controls.
3. Reading tests come from curated passage/question content and configured generation pipelines exposed through `/reading/tests/*`.
4. Listening tests come from curated audio/question assets plus generation pipelines exposed through `/listening/tests/*`.
5. Full exam orchestration composes module attempts/scores from `/exams/full/*` and module APIs.
6. Admin content operations are the governance layer for quality and publish controls.

## 8) Notification and Campaign System Contract

1. Keep existing mobile push behavior intact.
2. Support browser push registration/unregistration for web.
3. Support user-level preference toggles including offers and partner offers.
4. Support admin campaign flows: create, schedule (UTC), send now, cancel, and delivery monitoring.
5. Support partner-offer targeting:
   - all users
   - all partner owners
   - partner owners by type or id
   - partner-attributed users (90-day windows)
   - owners plus attributed union
6. Respect opt-out preferences before dispatch.

## 9) Role and Permission Contract

1. `superadmin`: full control, including flags, notifications, role operations, billing support controls.
2. `content_manager`: content lifecycle and related operational surfaces.
3. `support_agent`: user/subscription support operations with limited admin scope.
4. Role gating must be enforced in backend and frontend route guards.

## 10) SEO, Analytics, and Growth Foundations

1. Metadata and Open Graph coverage on marketing pages.
2. Structured data on key trust and conversion pages.
3. Dynamic `sitemap.xml` and `robots.txt`.
4. Dynamic social image generation for shareability.
5. Firebase analytics instrumentation for web route areas and key events.
6. User-level analytics properties for role/plan attribution.

## 11) Quality and Safety Gates

1. Speaking contract tests before and after speaking-adjacent changes.
2. Backend unit/integration tests for new module/admin APIs.
3. Web E2E tests for learner/admin critical journeys.
4. Browser audio edge-case tests for speaking permission/device failures.
5. Accessibility checks for keyboard flow, landmarks, focus order, and contrast.
6. Non-functional checks for speaking regression and new module load behavior.

## 12) V1 Boundaries

1. English-only UI in V1.
2. Email/password auth only.
3. No breaking speaking contract redesign.
4. No out-of-scope social/gamification expansion beyond defined notifications/partner flows.

## 13) Definition of Complete (V1)
The web app is considered complete when all are true:

1. Marketing is conversion-ready and trust-complete.
2. Learner can complete all module and full-exam journeys end-to-end.
3. Admin can operate content, users, subscriptions, flags, campaigns, partners, and audit workflows.
4. Billing, notifications, analytics, SEO, and auth/session recovery are production-usable.
5. Speaking compatibility is proven unchanged by contract tests.
