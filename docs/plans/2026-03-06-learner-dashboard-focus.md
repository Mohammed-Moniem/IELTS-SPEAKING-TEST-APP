# Learner Dashboard Focus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the learner dashboard so it presents one dominant next action, one clear resume path, and one real weakest-skill recommendation.

**Architecture:** Keep the rewrite frontend-scoped by updating the learner dashboard page to fetch `dashboard-view` and `progress-view` in parallel. Use the existing dashboard payload for activity/resume/topic prompts and derive the weakest skill from `progress-view.skillBreakdown`, reusing the same gap-based logic already present in the study-plan page.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing `webApi` client, shared `ui/v2` components, Playwright E2E tests

---

### Task 1: Add dashboard regression tests for the new decision hierarchy

**Files:**
- Modify: `web-saas/tests/e2e/production-smoke.spec.ts`
- Modify: `web-saas/tests/e2e/auth-and-gating.spec.ts`
- Reference: `web-saas/app/(learner)/app/dashboard/page.tsx`

**Step 1: Write the failing test**

Add a new smoke test that:

- mocks `dashboard-view` with a non-null `resume`
- mocks `progress-view` with a valid `skillBreakdown`
- visits `/app/dashboard`
- expects a dominant resume hero CTA
- expects weakest-skill secondary text to exist
- expects the old top-level `Start New Test` CTA to be absent

Add a second test that:

- mocks `resume: null`
- mocks `progress-view`
- expects the hero to focus on the weakest skill

Add a third test that:

- lets `dashboard-view` succeed
- makes `progress-view` fail
- expects the dashboard to render with a fallback primary action instead of crashing

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: FAIL because the current dashboard still shows competing primary actions and has no weakest-skill hero.

**Step 3: Write minimal implementation**

Do not implement yet. Only keep the failing tests in place.

**Step 4: Run test to verify it still fails for the right reason**

Run the same command again and confirm the failures are about dashboard content, not broken mocks.

**Step 5: Commit**

```bash
git add web-saas/tests/e2e/production-smoke.spec.ts web-saas/tests/e2e/auth-and-gating.spec.ts
git commit -m "test: cover learner dashboard action hierarchy"
```

### Task 2: Add weakest-skill derivation helpers to the dashboard page

**Files:**
- Modify: `web-saas/app/(learner)/app/dashboard/page.tsx`
- Reference: `web-saas/app/(learner)/app/study-plan/page.tsx`
- Reference: `web-saas/src/lib/types/index.ts`

**Step 1: Write the failing test**

Use the tests from Task 1 as the failing contract. No separate unit test is necessary unless helper extraction becomes non-trivial.

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: FAIL

**Step 3: Write minimal implementation**

In `dashboard/page.tsx`:

- load `dashboard-view` and `progress-view` in parallel
- add local derived state for:
  - weakest skill
  - target band
  - gap to target
  - fallback primary action when progress data is unavailable
- keep error handling resilient so `progress-view` failure does not break the page

Prefer copying only the minimal recommendation logic needed from study plan rather than importing a large page-local helper directly.

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: the weakest-skill scenarios now pass or fail only on layout/copy details, not missing data flow.

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/dashboard/page.tsx web-saas/tests/e2e/production-smoke.spec.ts web-saas/tests/e2e/auth-and-gating.spec.ts
git commit -m "feat: derive dashboard weakest-skill guidance"
```

### Task 3: Rebuild the top-of-page hierarchy around one primary action

**Files:**
- Modify: `web-saas/app/(learner)/app/dashboard/page.tsx`
- Reference: `web-saas/src/components/ui/v2/index.tsx`

**Step 1: Write the failing test**

Extend the dashboard smoke expectations so they verify:

- only one filled primary CTA appears in the hero area
- resume state renders `Resume now`
- no-resume state renders a weakest-skill CTA like `Practice Speaking`
- old hero-level quick-practice competition is removed

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: FAIL because the current layout still renders the old quick-practice emphasis and top CTA.

**Step 3: Write minimal implementation**

Refactor the top of the page into:

- lightweight `PageHeader`
- one dominant hero section
- one secondary focus grid below it

Rules:

- if `resume` exists, hero CTA is `Resume now`
- else hero CTA is the weakest-skill action
- remove the header `Start New Test` action
- demote quick-practice from oversized featured cards to secondary support content

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: PASS for the new action hierarchy assertions.

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/dashboard/page.tsx web-saas/tests/e2e/production-smoke.spec.ts
git commit -m "feat: prioritize learner dashboard next action"
```

### Task 4: Reframe supporting cards and copy

**Files:**
- Modify: `web-saas/app/(learner)/app/dashboard/page.tsx`
- Test: `web-saas/tests/e2e/production-smoke.spec.ts`

**Step 1: Write the failing test**

Extend smoke assertions to verify:

- topic recommendations are labeled honestly, e.g. `Suggested speaking prompts`
- weakest-skill support card includes module name and reason
- KPI cards appear below the action area

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: FAIL because the old labels and ordering still exist.

**Step 3: Write minimal implementation**

Update copy and layout:

- rename `Recommended for you` to match topic data
- add a compact weakest-skill explanation card
- move KPI row below the hero/supporting cards
- keep recent activity lower on the page

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard"`  
Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/dashboard/page.tsx web-saas/tests/e2e/production-smoke.spec.ts
git commit -m "feat: clarify learner dashboard supporting guidance"
```

### Task 5: Verify responsive and fallback behavior

**Files:**
- Modify: `web-saas/tests/e2e/auth-and-gating.spec.ts`
- Modify: `web-saas/tests/e2e/production-smoke.spec.ts`
- Reference: `web-saas/src/components/layout/LearnerShell.tsx`

**Step 1: Write the failing test**

Add or update assertions so the redesigned dashboard still works in:

- small-screen learner shell
- empty dashboard state (`resume: null`, empty activity, empty quickPractice, empty recommended)
- progress-fetch failure fallback

**Step 2: Run test to verify it fails**

Run:

- `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts -g "mobile drawer" --project=chromium`
- `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard" --project=chromium`

Expected: FAIL if the new hierarchy breaks mobile flow or empty-state rendering.

**Step 3: Write minimal implementation**

Adjust layout stacking, text wrapping, and conditional rendering so:

- hero remains readable on small screens
- secondary cards stack cleanly
- fallback action stays present when progress data is unavailable

**Step 4: Run test to verify it passes**

Run:

- `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts -g "mobile drawer" --project=chromium`
- `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard" --project=chromium`

Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/dashboard/page.tsx web-saas/tests/e2e/auth-and-gating.spec.ts web-saas/tests/e2e/production-smoke.spec.ts
git commit -m "fix: preserve dashboard hierarchy across fallback states"
```

### Task 6: Final verification

**Files:**
- Verify: `web-saas/app/(learner)/app/dashboard/page.tsx`
- Verify: `web-saas/tests/e2e/production-smoke.spec.ts`
- Verify: `web-saas/tests/e2e/auth-and-gating.spec.ts`

**Step 1: Run focused dashboard regression**

Run:

- `cd web-saas && npx playwright test tests/e2e/production-smoke.spec.ts -g "dashboard|full exam page renders learner guidance" --project=chromium`
- `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts -g "mobile drawer" --project=chromium`

Expected: PASS

**Step 2: Run typecheck**

Run: `cd web-saas && npm run typecheck`  
Expected: PASS

**Step 3: Optional broader confidence pass**

Run: `cd web-saas && npx playwright test tests/e2e/accessibility.spec.ts --project=chromium`  
Expected: PASS or known unrelated failures called out explicitly.

**Step 4: Clean generated Playwright artifacts**

Run:

- `git restore --source=HEAD --worktree --staged -- web-saas/output/playwright/report`
- `find web-saas/test-results -mindepth 1 -delete`
- `test -d web-saas/test-results && rmdir web-saas/test-results || true`

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/dashboard/page.tsx web-saas/tests/e2e/production-smoke.spec.ts web-saas/tests/e2e/auth-and-gating.spec.ts
git commit -m "feat: rework learner dashboard action hierarchy"
```
