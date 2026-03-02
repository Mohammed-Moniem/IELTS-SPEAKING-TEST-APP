# Spokio Full Application Testing Master Plan

Document date: March 3, 2026  
Applies to: `web-saas`, `micro-service-boilerplate-main`, `mobile`

## 1. Objective

This document defines a complete test strategy and scenario catalog for:

1. All user types and role combinations.
2. All core functional modules.
3. All unauthenticated marketing routes.
4. Non-functional requirements (performance, security, accessibility, reliability, SEO, GEO, observability, compatibility).

The goal is to provide a release-ready, execution-ready QA blueprint that can be automated and used for manual acceptance.

## 2. Scope

In scope:

1. Marketing and guide pages (`/`, `/pricing`, `/features`, `/ielts/*`, auth entry pages, blog, policy pages).
2. Learner app routes (`/app/*`) and module workflows.
3. Admin operations (`/admin/*`) with RBAC.
4. Backend APIs under `/api/v1/*` including auth, modules, guides, billing, social, admin.
5. Mobile application parity for critical flows.
6. Guide corpus quality and SEO/GEO content validation.

Out of scope:

1. Third-party provider internal infrastructure behavior (Stripe internals, OpenAI internals, ElevenLabs internals).
2. App store review process.

## 3. User Types and Access Matrix

### 3.1 Primary user types

1. Unauthenticated visitor.
2. Authenticated learner - Free.
3. Authenticated learner - Premium.
4. Authenticated learner - Pro.
5. Authenticated learner - Team member.
6. Admin - Superadmin.
7. Admin - Content Manager.
8. Admin - Support Agent.
9. Partner user.
10. Advertiser user.
11. System actors (webhook callers, schedulers, background jobs).

### 3.2 Access expectations

| Area | Unauth | Learner | Superadmin | Content Manager | Support Agent | Partner/Advertiser |
|---|---|---|---|---|---|---|
| Marketing routes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/app/*` learner routes | No (gated) | Yes | Optional (if learner session) | Optional | Optional | Optional |
| `/admin/overview` | No | No | Yes | Yes | Yes | No |
| `/admin/content` | No | No | Yes | Yes | No | No |
| `/admin/users` | No | No | Yes | No | Yes | No |
| `/admin/partners` | No | No | Yes | No | No | No |
| `/admin/flags` | No | No | Yes | No | No | No |
| Partner/Advertiser dashboards | No | By entitlement | Admin override | Admin override | Admin support | Yes |

## 4. Test Environments and Data

### 4.1 Environments

1. Local dev: Next.js + API + local/stubbed services.
2. QA/Staging: production-like infra, seeded data, test keys.
3. Production smoke: read-only checks plus safe synthetic transactions.

### 4.2 Required datasets

1. Accounts for each learner plan tier.
2. Accounts for each admin role.
3. Partner and advertiser fixtures.
4. Guide corpus sample set:
   1. Legacy routes.
   2. Hierarchical canonical routes.
   3. Dynamic routes with long slug paths.
5. Billing fixtures:
   1. Active subscription.
   2. Trial state.
   3. Cancelled subscription.
   4. Failed checkout.
6. Speaking/listening/writing/reading module fixtures.
7. Social fixtures:
   1. Friend requests.
   2. Conversations with message history.
   3. Group membership and role variants.

## 5. Functional Test Scenarios

## 5.1 Unauthenticated and Marketing Page Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| UA-001 | Unauth | Open `/` | Hero, nav, CTAs render; no blocking errors |
| UA-002 | Unauth | Open `/pricing` | Plan cards load; CTA targets valid |
| UA-003 | Unauth | Open `/features` | Feature sections load; links valid |
| UA-004 | Unauth | Open `/advertise` | Advertise hero and package sections render |
| UA-005 | Unauth | Open `/guarantee` | Guarantee content visible and linked |
| UA-006 | Unauth | Open `/about` | About sections render with valid metadata |
| UA-007 | Unauth | Open `/contact` | Contact form/info blocks render |
| UA-008 | Unauth | Open `/editorial-policy` | Policy content and trust links render |
| UA-009 | Unauth | Open `/methodology` | Methodology content and references render |
| UA-010 | Unauth | Open `/blog` | Blog index renders with cards and links |
| UA-011 | Unauth | Open `/blog/[slug]` known slug | Article renders and is indexable |
| UA-012 | Unauth | Open invalid `/blog/[slug]` | 404 page rendered |
| UA-013 | Unauth | Open `/ielts` | Hub renders all allowed modules |
| UA-014 | Unauth | Verify removed modules on `/ielts` | `offers` and `membership` sections are absent |
| UA-015 | Unauth | Open `/ielts/[...segments]` valid route | Guide detail renders with structured blocks |
| UA-016 | Unauth | Open invalid guide route | 404 page rendered |
| UA-017 | Unauth | Open `/ielts/offers` | 404 page rendered |
| UA-018 | Unauth | Open `/ielts/membership` | 404 page rendered |
| UA-019 | Unauth | Open `/login` | Form visible; `robots=noindex,nofollow` |
| UA-020 | Unauth | Open `/register` | Form visible; `robots=noindex,nofollow` |
| UA-021 | Unauth | Open `/forgot-password` | Recovery form state works |
| UA-022 | Unauth | Open `/reset-password` with token | Reset form accepts token and submits |
| UA-023 | Unauth | Open `/verify-email` | Verification state and messaging render |
| UA-024 | Unauth | Open unknown route | Branded 404 page shown |
| UA-025 | Unauth | Click dashboard link without login | Redirect to home or sign-in-required gate, not blank page |
| UA-026 | Unauth | Marketing variant query `?mkt_variant=motion` | Cookie set, URL cleaned |
| UA-027 | Unauth | Marketing variant query `?mkt_variant=control` | Cookie set, URL cleaned |
| UA-028 | Unauth | Theme switch on marketing pages | Light/dark theme styles remain readable |
| UA-029 | Unauth | Footer/header link integrity | No broken internal links |
| UA-030 | Unauth | CLS/LCP on core marketing pages | No major layout shift; LCP within threshold |

## 5.2 Authentication and Session Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| AS-001 | Unauth | Register new account | Account created and session established |
| AS-002 | Unauth | Login with valid credentials | Tokens stored, app config fetched |
| AS-003 | Unauth | Login with invalid credentials | Clear error message, no session |
| AS-004 | Learner | Access token expires | Refresh flow rotates tokens silently |
| AS-005 | Learner | Refresh token revoked | Session cleared and gated page shown |
| AS-006 | Learner | Logout | Session cleared from storage and API headers |
| AS-007 | Unauth | Access `/app/dashboard` | Gated view shown (no protected data leak) |
| AS-008 | Learner | Feature flag disabled for module | Route shows module-disabled state |
| AS-009 | Learner | Browser refresh on protected route | Session restored correctly when valid |
| AS-010 | Learner | Simultaneous tabs | Auth state and token refresh remain consistent |

## 5.3 Learner Core Module Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| LM-001 | Learner | Open `/app/dashboard` | KPIs, resume blocks, recommendations load |
| LM-002 | Learner | Writing generate task | Task payload loads and renders |
| LM-003 | Learner | Writing submit essay | Evaluation response shown with band breakdown |
| LM-004 | Learner | Writing history detail deep link | Detail page loads by submission id |
| LM-005 | Learner | Reading start test | Test questions load in sequence |
| LM-006 | Learner | Reading review then submit | Score and feedback displayed |
| LM-007 | Learner | Reading history detail | Attempt detail renders |
| LM-008 | Learner | Listening start test | Test loads and playback/transcript fallback works |
| LM-009 | Learner | Listening submit | Score and feedback displayed |
| LM-010 | Learner | Listening history detail | Attempt detail renders |
| LM-011 | Learner | Speaking practice full cycle | Recording/transcription/evaluation flow works |
| LM-012 | Learner | Speaking with mic denied | Explicit error and fallback path shown |
| LM-013 | Learner | Speaking no device available | Non-crashing error state |
| LM-014 | Learner | Recorder runtime failure | User can continue with fallback |
| LM-015 | Learner | Upload timeout path | User gets retry and manual fallback |
| LM-016 | Learner | Transcription failure | Recovery path available |
| LM-017 | Learner | Full exam orchestration | End-to-end exam can be completed |
| LM-018 | Learner | Resume interrupted exam | Recovery state restores progress |
| LM-019 | Learner | Progress page deep links | Links to module pages resolve |
| LM-020 | Learner | Notification settings update | Preference toggles persist |
| LM-021 | Learner | Library routes (`books/channels/vocabulary/collocations`) | All load and filter correctly |
| LM-022 | Learner | Rewards/achievements/leaderboard pages | Data and empty states behave correctly |
| LM-023 | Learner | Billing page in app | Current plan and available plans render |
| LM-024 | Learner | Settings/profile updates | Persist and reflect on reload |
| LM-025 | Learner | Mobile parity for module workflows | Behavior consistent with web contracts |

## 5.4 Billing and Subscription Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| BL-001 | Learner | Open billing with `checkout=cancel` | Cancel message shown, no plan change |
| BL-002 | Learner | Open billing with `checkout=success` | Success message and state refresh |
| BL-003 | Learner | Start checkout success path | Redirect to Stripe and back correctly |
| BL-004 | Learner | Checkout API failure | Error surfaced, no broken state |
| BL-005 | Learner | Plan comparison (monthly/annual) | Prices and savings render correctly |
| BL-006 | Learner | Plan badges and highlights | Pro is highlighted as intended |
| BL-007 | Learner | Plan card CTA alignment | Buttons aligned at card bottom |
| BL-008 | System | Stripe webhook idempotency | Duplicate events do not double-apply |
| BL-009 | Learner | Usage limit check by plan | Gating reflects active entitlement |
| BL-010 | Admin | Manual activation/update route | Entitlements applied correctly |

## 5.5 Social, Referral, and Gamification Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| SG-001 | Learner | Send friend request | Request appears in recipient queue |
| SG-002 | Learner | Accept/decline friend request | Relationship and status update |
| SG-003 | Learner | Block user | Interaction prevented per policy |
| SG-004 | Learner | 1:1 chat send/receive | Real-time delivery and persistence |
| SG-005 | Learner | Read receipts | Read status updates for sender |
| SG-006 | Learner | Typing indicators | Real-time indicator appears/disappears |
| SG-007 | Learner | Chat file upload/download | Attachment access control enforced |
| SG-008 | Learner | Group creation and invite | Group membership and invite states work |
| SG-009 | Learner | Group admin role changes | Admin add/remove enforcement works |
| SG-010 | Learner | Group messaging | Real-time fan-out to group room |
| SG-011 | Learner | Points summary and transactions | Totals and history are accurate |
| SG-012 | Learner | Redeem points | Balance and redemption records update |
| SG-013 | Learner | Achievements progress | Achievement state transitions correctly |
| SG-014 | Learner | Leaderboard opt-in/out | Visibility and ranking update |
| SG-015 | Learner | Referrals code/stats/history | Data integrity and attribution correctness |

## 5.6 Admin and RBAC Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| AD-001 | Superadmin | `/admin/overview` | Visible with KPI widgets |
| AD-002 | Content Manager | `/admin/overview` | Visible |
| AD-003 | Support Agent | `/admin/overview` | Visible |
| AD-004 | Content Manager | `/admin/content` | Allowed and editable |
| AD-005 | Support Agent | `/admin/content` | Permission denied |
| AD-006 | Support Agent | `/admin/users` | Allowed |
| AD-007 | Content Manager | `/admin/users` | Permission denied |
| AD-008 | Superadmin | `/admin/partners` | Allowed |
| AD-009 | Non-superadmin | `/admin/partners` | Permission denied |
| AD-010 | Superadmin | `/admin/flags` high-impact update | Requires confirmation gate |
| AD-011 | Superadmin | `/admin/flags` standard update | Applies with success response |
| AD-012 | Admin | `/admin/analytics` | Charts and KPIs render |
| AD-013 | Superadmin | `/admin/ai-cost` | AI usage views available |
| AD-014 | Admin | `/admin/subscriptions` | List/filter/update works |
| AD-015 | Admin | `/admin/users` role mutation | Audit trail recorded |
| AD-016 | Admin | `/admin/audit-logs` | Filter and pagination work |
| AD-017 | Superadmin | Admin notifications campaigns create/send | Immediate campaign executes |
| AD-018 | Superadmin | Scheduled campaign cancel | Cancel state persisted |
| AD-019 | Non-superadmin | Admin notifications page | Access denied |
| AD-020 | Admin | Admin ads and blog content routes | Render and actions work |

## 5.7 Partner and Advertiser Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| PA-001 | Partner | Open partner dashboard route | Authorized content only |
| PA-002 | Advertiser | Open advertiser route | Authorized content only |
| PA-003 | Unauth | Open partner/advertiser protected path | Redirect/gate, no data leak |
| PA-004 | Admin | Partner payout operations view | Summary and rows render |
| PA-005 | Admin | Partner codes targets listing | Pagination and filters valid |
| PA-006 | Admin | Payout batch detail inspection | Data and totals consistent |
| PA-007 | System | Conversion attribution ingestion | Correct partner linkage |
| PA-008 | Admin | Export/reporting operations | Output integrity validated |

## 5.8 Guides, Blog, SEO and GEO Scenarios

| ID | User | Scenario | Expected result |
|---|---|---|---|
| GD-001 | Unauth | `/ielts` module coverage cards | Counts and hub links valid |
| GD-002 | Unauth | Guide canonical path resolution | Valid path loads content |
| GD-003 | Unauth | Legacy guide path redirect/alias | Lands on canonical equivalent |
| GD-004 | Unauth | Dynamic guide links from hub | No 404 for valid routes |
| GD-005 | Unauth | Guide detail required blocks | Quick answer, mistakes, method, drill, checklist present |
| GD-006 | Unauth | Placeholder text detection | Placeholder copy not rendered |
| GD-007 | Unauth | Source links in guide content | Source section exists with valid URLs |
| GD-008 | Unauth | GEO section presence | High-intent question block present |
| GD-009 | Unauth | Guide FAQ schema | Valid FAQ JSON-LD emitted when FAQ exists |
| GD-010 | Unauth | Breadcrumb schema | Valid BreadcrumbList JSON-LD |
| GD-011 | Unauth | Article schema | Valid Article JSON-LD |
| GD-012 | Unauth | Blog index metadata | Canonical/title/description valid |
| GD-013 | Unauth | Blog detail metadata | Canonical/title/description valid |
| GD-014 | Unauth | Robots and sitemap | Public routes indexed; auth routes excluded |
| GD-015 | Unauth | `/login` and `/register` robots | `noindex,nofollow` enforced |
| GD-016 | Admin | Guide import job API | Sitemap import creates map entries |
| GD-017 | Admin | Guide page update/review/publish flow | State transitions enforce QA gates |
| GD-018 | Admin | QA gate failures | Publish blocked when mandatory blocks missing |
| GD-019 | System | Guide public cache behavior | Cache hit ratio and invalidation work |
| GD-020 | Unauth | Guide related routes | Related links resolve and are relevant |

## 6. Non-functional Requirements and Scenarios

## 6.1 Performance

| ID | Scenario | Target |
|---|---|---|
| PF-001 | Home page Web Vitals | LCP <= 2.5s, CLS < 0.1, INP <= 200ms |
| PF-002 | Pricing and IELTS hub Web Vitals | LCP <= 2.8s, CLS < 0.1 |
| PF-003 | Guide detail page first render | TTFB p95 <= 800ms in staging |
| PF-004 | Guide API response latency | p95 <= 600ms (cached), p95 <= 1200ms (uncached) |
| PF-005 | Guide tree endpoint throughput | No error spike at 100 RPS synthetic read load |
| PF-006 | Auth refresh flow overhead | Token refresh adds <= 400ms median |
| PF-007 | Admin dashboards load | First useful data <= 2.5s in staging |
| PF-008 | Mobile module API calls | p95 <= 900ms on LTE profile |
| PF-009 | Memory profile during long learner session | No unbounded growth > 15 percent over 30 min |
| PF-010 | Marketing animation overhead | No measurable FPS collapse under 45 FPS median on mid-tier devices |

## 6.2 Reliability and Resilience

| ID | Scenario | Acceptance criteria |
|---|---|---|
| RL-001 | Backend restart during active session | Client recovers after retry/refresh |
| RL-002 | Third-party AI timeout | User sees actionable fallback path |
| RL-003 | Stripe transient failure | Checkout failure is explicit and recoverable |
| RL-004 | Socket disconnect/reconnect | Presence and message delivery recover |
| RL-005 | Duplicate webhook delivery | Idempotent processing, no double state mutation |
| RL-006 | Partial API outage | Critical pages fail gracefully, no white-screen |
| RL-007 | Guide cache stale invalidation | Updates become visible after invalidation/TTL |
| RL-008 | DB read replica lag or delay | No data corruption; stale tolerance defined |
| RL-009 | Concurrent role updates | RBAC state remains consistent |
| RL-010 | Corrupted local session storage | App falls back to signed-out state safely |

## 6.3 Security

| ID | Scenario | Acceptance criteria |
|---|---|---|
| SC-001 | Protected route without JWT | Access denied, no data leakage |
| SC-002 | RBAC bypass attempt on admin APIs | 403 for unauthorized roles |
| SC-003 | XSS payload in input fields | Output sanitized and inert |
| SC-004 | NoSQL/operator injection payloads | Request blocked/sanitized |
| SC-005 | Rate limit abuse on public APIs | Limits triggered and logged |
| SC-006 | Session fixation check | New auth session rotates tokens |
| SC-007 | CSRF on state-changing endpoints | Requests rejected without valid auth flow |
| SC-008 | Secret exposure in client bundles | No backend secrets in client assets |
| SC-009 | File upload security checks | MIME/size/path validation enforced |
| SC-010 | Audit logging for admin actions | Sensitive actions recorded with actor and target |

## 6.4 Accessibility

| ID | Scenario | Standard |
|---|---|---|
| AX-001 | Keyboard-only nav on login/register | All controls reachable and operable |
| AX-002 | Landmark and heading structure | WCAG 2.2 AA baseline |
| AX-003 | Color contrast dark and light themes | Minimum AA contrast ratios |
| AX-004 | Focus indicators across CTAs/forms | Visible and consistent |
| AX-005 | Screen-reader labels for forms | Inputs and errors are announced |
| AX-006 | Motion reduction preference | Animations reduce/disable when requested |
| AX-007 | Guide page semantic structure | Ordered headings and list semantics |
| AX-008 | Axe critical/serious violations | Zero critical and zero serious |

## 6.5 SEO and GEO

| ID | Scenario | Acceptance criteria |
|---|---|---|
| SGEO-001 | Canonical tags across public pages | Single canonical per page, valid URL |
| SGEO-002 | Robots policy | Auth routes noindex, public pages indexable |
| SGEO-003 | Sitemap completeness | All indexable routes included, auth excluded |
| SGEO-004 | Structured data validity | Article/Breadcrumb/FAQ JSON-LD valid |
| SGEO-005 | Guide answer-first structure | Direct answer appears in above-the-fold content |
| SGEO-006 | Source-backed claims | Source references included for factual claims |
| SGEO-007 | GEO query blocks | High-intent query coverage present per guide |
| SGEO-008 | Internal linking depth | Hub -> module -> detail chain without orphans |
| SGEO-009 | Metadata uniqueness | Unique title/description across indexed pages |
| SGEO-010 | AI answer extractability | 40-80 word concise answer block present for guide intents |

## 6.6 Compatibility and UX Robustness

| ID | Scenario | Acceptance criteria |
|---|---|---|
| CX-001 | Browser compatibility (Chrome, Safari, Firefox, Edge) | Core flows pass |
| CX-002 | Mobile viewport responsiveness | No overflow/cutoff on major breakpoints |
| CX-003 | Slow network profile | Loading/error states remain clear |
| CX-004 | JavaScript disabled partial check | Critical SEO pages still readable |
| CX-005 | Dark mode visual consistency | No unreadable text or broken components |
| CX-006 | Localization-safe date rendering | No hydration mismatch from locale drift |

## 6.7 Observability and Operability

| ID | Scenario | Acceptance criteria |
|---|---|---|
| OB-001 | Request tracing headers | Request ID/Unique-Reference-Code logged end to end |
| OB-002 | Error tracking coverage | Frontend/backend errors captured with context |
| OB-003 | Key funnel analytics | Page view, CTA click, register submit events emitted |
| OB-004 | Guide-specific analytics | guide view, practice click, next-route click tracked |
| OB-005 | Admin action auditability | Role/flag/content changes traceable |
| OB-006 | Dashboard health endpoints | `/health` and key probes monitored |

## 7. Automation Coverage Map

Current Playwright suites already cover major paths:

1. `web-saas/tests/e2e/production-smoke.spec.ts` - public + learner smoke.
2. `web-saas/tests/e2e/auth-and-gating.spec.ts` - auth gates and feature flags.
3. `web-saas/tests/e2e/module-flows.spec.ts` - writing/reading/listening workflows.
4. `web-saas/tests/e2e/speaking-flow.spec.ts` - speaking runtime and fallback paths.
5. `web-saas/tests/e2e/full-exam-orchestration.spec.ts` - full exam lifecycle.
6. `web-saas/tests/e2e/admin-rbac-matrix.spec.ts` - role permissions.
7. `web-saas/tests/e2e/admin-operations.spec.ts` - content/flags/payout/admin actions.
8. `web-saas/tests/e2e/admin-notifications.spec.ts` - campaign workflows.
9. `web-saas/tests/e2e/billing-and-session.spec.ts` - checkout/session hardening.
10. `web-saas/tests/e2e/notification-settings.spec.ts` - preferences persistence.
11. `web-saas/tests/e2e/seo-marketing.spec.ts` - metadata/robots/sitemap/schema.
12. `web-saas/tests/e2e/marketing-motion-variant.spec.ts` - variant cookie and URL cleanup.
13. `web-saas/tests/e2e/marketing-motion-visuals.spec.ts` - motion variant rendering.
14. `web-saas/tests/e2e/accessibility.spec.ts` - critical accessibility checks.

Required automation additions to close full-plan gaps:

1. Guide content quality assertions:
   1. Minimum body depth for generated guides.
   2. Placeholder phrase blacklist checks.
   3. GEO block presence checks across sampled routes.
2. API performance checks:
   1. Guide tree/page p95 latency benchmarks.
   2. Cache hit ratio and stale invalidation tests.
3. Security hardening suite:
   1. Auth bypass and RBAC negative tests at API level.
   2. Input sanitization fuzz tests.
4. Cross-browser visual + interaction matrix.
5. Mobile E2E parity suite for top learner flows.

## 8. Execution Strategy

### 8.1 Test phases per release

1. Phase A - Static quality gates:
   1. Lint, typecheck, build.
2. Phase B - API and component tests:
   1. Unit and integration tests for backend and frontend data layers.
3. Phase C - E2E regression:
   1. Critical path suites (auth, learner modules, billing, admin RBAC, guides, SEO).
4. Phase D - Non-functional:
   1. Performance, accessibility, security scans, reliability drills.
5. Phase E - Manual exploratory:
   1. UX, copy quality, dark-mode polish, real browser/device checks.

### 8.2 Test priorities

1. P0:
   1. Auth/session.
   2. Billing and entitlement.
   3. Learner module submit flows.
   4. Admin RBAC.
   5. Guide routing and content integrity.
2. P1:
   1. Social features.
   2. Partner/advertiser operations.
   3. Advanced analytics and campaign operations.
3. P2:
   1. Visual regression for secondary content pages.
   2. Extended compatibility matrix.

## 9. Entry and Exit Criteria

### 9.1 Entry criteria

1. Test environment deployed and stable.
2. Seed data loaded for all roles.
3. Third-party sandbox keys configured.
4. Test runbook and incident contacts available.

### 9.2 Exit criteria

1. 100 percent pass on all P0 automated suites.
2. No open Severity 1 or Severity 2 defects.
3. Non-functional gates pass:
   1. Performance targets in Section 6.
   2. Accessibility critical/serious zero.
   3. Security negative tests pass.
4. Manual sign-off for:
   1. Unauthenticated pages.
   2. Guide quality and factual usefulness.
   3. Admin operations.

## 10. Defect Severity Model

1. Severity 1:
   1. Security breach, data leak, checkout corruption, auth bypass, production crash.
2. Severity 2:
   1. Core feature broken (module submit, billing, admin permissions incorrect).
3. Severity 3:
   1. Major UX/content issue with workaround.
4. Severity 4:
   1. Cosmetic or low-impact issue.

## 11. Reporting Template

Use this template per test cycle:

1. Build/commit ID.
2. Environment.
3. Pass/fail by suite.
4. Non-functional benchmark summary.
5. Top open defects by severity.
6. Risk statement.
7. Release recommendation:
   1. Go.
   2. Go with mitigations.
   3. No-go.

## 12. Immediate Next Actions

1. Convert this document into executable test cases in your test management tool (Jira/Xray, TestRail, or equivalent).
2. Add the missing automation items in Section 7.
3. Run one full dry-run on staging and baseline non-functional metrics.
4. Set this document as release gate reference for all future production pushes.
