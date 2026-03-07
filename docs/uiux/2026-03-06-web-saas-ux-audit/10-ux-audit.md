# UX Audit

Severity model:

- `P0`: critical blocker
- `P1`: major friction with measurable impact
- `P2`: moderate friction
- `P3`: polish

Priority score formula:

`priority_score = (impact * confidence * risk) / effort`

## P0

### UX-01: Learner shell is not responsive for mobile or narrow laptop use

- Evidence:
  - The learner shell uses a fixed `264px` sidebar and always offsets main content by `ml-[264px]` with no breakpoint fallback in `web-saas/src/components/layout/LearnerShell.tsx`.
  - This appears at [LearnerShell.tsx](../../../../web-saas/src/components/layout/LearnerShell.tsx) lines 80-80 and 194-199.
- Affected surfaces:
  - All learner routes
- Impact summary:
  - The primary product experience is effectively desktop-only. On narrow screens, the sidebar consumes too much width and the main content starts partially off-canvas.
- Severity:
  - `P0`
- Scoring:
  - Impact `5`
  - Confidence `5`
  - Effort `3`
  - Risk `5`
  - Priority score `41.7`
- Suggested direction:
  - Use a breakpoint-driven shell: desktop sidebar, tablet rail, and mobile bottom nav or drawer.
  - Keep "resume practice" and "start session" actions visible without horizontal scrolling.
- Success metric:
  - All learner pages remain fully usable at `320px`, `375px`, and `768px` widths without overlap or hidden primary actions.
- Confidence note:
  - High. This is visible directly in layout code.

## P1

### UX-02: Marketing navigation disappears on mobile without a replacement pattern

- Evidence:
  - Marketing nav is `hidden md:flex` with no visible mobile menu or drawer in `web-saas/src/components/layout/MarketingShell.tsx`.
  - See [MarketingShell.tsx](../../../../web-saas/src/components/layout/MarketingShell.tsx) lines 62-75.
- Affected surfaces:
  - Home, pricing, features, guides, about, contact
- Impact summary:
  - Users on mobile lose orientation and cannot easily reach high-intent pages like pricing, methodology, and guides.
- Severity:
  - `P1`
- Scoring:
  - Impact `4`
  - Confidence `5`
  - Effort `2`
  - Risk `4`
  - Priority score `40`
- Suggested direction:
  - Add a mobile menu with top tasks: pricing, guides, methodology, login/register.
  - Preserve a sticky CTA while still exposing discovery routes.
- Success metric:
  - Mobile users can access primary marketing routes in two taps or fewer.
- Confidence note:
  - High. Confirmed in shell code and screenshots.

### UX-03: Auth field labeling creates accessibility ambiguity and already fails automated keyboard coverage

- Evidence:
  - The password toggle button sits inside the password label wrapper on login, causing `getByLabel('Password')` to resolve to multiple elements.
  - See [page.tsx](../../../../web-saas/app/(marketing)/login/page.tsx) lines 66-90.
  - `npm run test:a11y` failed on all browsers because of this issue on `/login`.
- Affected surfaces:
  - Login now, register likely similar pattern
- Impact summary:
  - Assistive technology and keyboard users get ambiguous control labeling on a high-friction conversion step.
- Severity:
  - `P1`
- Scoring:
  - Impact `4`
  - Confidence `5`
  - Effort `1`
  - Risk `4`
  - Priority score `80`
- Suggested direction:
  - Use explicit `htmlFor` labels for inputs and separate accessible labels for auxiliary controls like "Show password."
  - Make validation and recovery copy more explicit.
- Success metric:
  - Login/register pass keyboard and label-based E2E tests across Chromium, Firefox, and WebKit.
- Confidence note:
  - High. This is backed by automated failures.

### UX-04: Speaking tabs and filter chips fail color-contrast requirements

- Evidence:
  - `SegmentedTabs` uses `text-gray-500` over `bg-gray-100/80`, which produced serious `color-contrast` violations in automated accessibility testing.
  - See [index.tsx](../../../../web-saas/src/components/ui/v2/index.tsx) lines 157-168.
  - `npm run test:a11y` failed on `/app/speaking` in Chromium, Firefox, and WebKit for contrast issues.
- Affected surfaces:
  - Speaking page now
  - Any other surfaces using `SegmentedTabs`
- Impact summary:
  - Secondary actions are visually muted to the point of failing WCAG AA, especially for low-vision users.
- Severity:
  - `P1`
- Scoring:
  - Impact `4`
  - Confidence `5`
  - Effort `1`
  - Risk `4`
  - Priority score `80`
- Suggested direction:
  - Darken inactive text, strengthen active-state contrast, and review all gray-on-gray chips and badges.
- Success metric:
  - Zero serious/critical axe contrast issues on key learner and auth pages.
- Confidence note:
  - High. Backed by test output and component code.

### UX-05: Learner-facing pages expose internal implementation language instead of learner outcomes

- Evidence:
  - Billing header says "Full local test-mode flow..." and shows internal state badges like `Stripe: Connected`, `Mode: test`, and `Current: plan`.
  - See [page.tsx](../../../../web-saas/app/(learner)/app/billing/page.tsx) lines 162-170.
  - Settings exposes "Study Defaults (UI Only)" and push states like "unsupported" and "not registered."
  - See [page.tsx](../../../../web-saas/app/(learner)/app/settings/page.tsx) lines 170-183.
  - Tests page subtitle mentions "no manual IDs" per search results.
- Affected surfaces:
  - Billing, settings, full exams, likely other learner pages
- Impact summary:
  - Internal or staging language lowers product trust and makes the app feel unfinished even when functionality exists.
- Severity:
  - `P1`
- Scoring:
  - Impact `4`
  - Confidence `5`
  - Effort `1`
  - Risk `4`
  - Priority score `80`
- Suggested direction:
  - Rewrite status language around learner outcomes: what they can do, what changed, and what action to take next.
  - Keep diagnostic details behind expandable support panels.
- Success metric:
  - No learner-facing page contains internal environment or implementation language by default.
- Confidence note:
  - High. Directly visible in route code and screenshots.

### UX-06: Marketing funnel explains the product, but it does not build enough proof or decision confidence

- Evidence:
  - Home and pricing pages emphasize product breadth and plans, but screenshots show limited social proof, testimonials, results proof, or guided recommendation patterns.
  - Home page code centers on value pillars and journey education; pricing offers many choices without a guided selector or strong comparative framing.
- Affected surfaces:
  - Home, pricing, register
- Impact summary:
  - Visitors can understand what Spokio is, but they have less help deciding why it is credible or which plan they should choose.
- Severity:
  - `P1`
- Scoring:
  - Impact `4`
  - Confidence `4`
  - Effort `3`
  - Risk `4`
  - Priority score `21.3`
- Suggested direction:
  - Add proof above the fold: success metrics, testimonials, sample score movement, and "best for you if..." plan framing.
  - Reduce decision load by recommending one default path by exam timeline.
- Success metric:
  - Higher home-to-pricing CTR, pricing-to-register CTR, and plan-selection completion rate.
- Confidence note:
  - Medium. Strong heuristic confidence, but no funnel analytics were provided.

## P2

### UX-07: Dashboard hierarchy is attractive but does not focus attention on one dominant next action

- Evidence:
  - The dashboard presents KPI cards, multiple quick-practice cards, a resume block, recommendations, premium upsell, and a recent-activity table at similar visual weight.
  - Existing screenshot shows dense content without a clear daily agenda.
- Affected surfaces:
  - Learner dashboard
- Impact summary:
  - Returning learners see many good options, but not one obvious best option. That increases hesitation.
- Severity:
  - `P2`
- Scoring:
  - Impact `3`
  - Confidence `4`
  - Effort `3`
  - Risk `3`
  - Priority score `12`
- Suggested direction:
  - Collapse the dashboard into "Today," "Resume," and "Improve your weakest skill."
  - Demote passive history and upsell content below the fold.
- Success metric:
  - Increased click-through on the first in-app CTA within the first 10 seconds of a return visit.
- Confidence note:
  - Medium-high. Supported by screenshot review and page structure.

### UX-08: Progress and empty states describe missing data but rarely tell the learner what to do next

- Evidence:
  - Progress includes passive messages like "No sufficient scoring data yet for this range" and "No improvement cards available yet."
  - See search results from `web-saas/app/(learner)/app/progress/page.tsx`.
- Affected surfaces:
  - Progress
  - Writing history and other feedback detail states with passive no-data copy
- Impact summary:
  - When insights are incomplete, the product misses a strong opportunity to route the learner into the exact action that unlocks those insights.
- Severity:
  - `P2`
- Scoring:
  - Impact `3`
  - Confidence `5`
  - Effort `2`
  - Risk `3`
  - Priority score `22.5`
- Suggested direction:
  - Replace passive empty states with prescriptive CTAs: "Complete one speaking simulation to unlock fluency insights."
  - Show thresholds and expected unlock value.
- Success metric:
  - More users complete the next recommended activity after viewing an empty or low-data state.
- Confidence note:
  - High. The current copy is explicit.

## Brand-Aware Notes

What already works:

- The visual system feels modern, premium, and coherent across marketing and learner surfaces.
- The learner app communicates breadth and seriousness better than a typical exam-prep tool.
- The product already has clear module segmentation and a strong purple-led brand signature.

Where to evolve, not rebrand:

- Make the brand feel more trustworthy, not just polished.
- Increase visual contrast and action clarity before adding more visual flair.
- Use the premium style to spotlight progress and certainty, not to decorate operational status.
