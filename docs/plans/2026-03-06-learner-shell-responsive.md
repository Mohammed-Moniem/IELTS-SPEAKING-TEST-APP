# Learner Shell Responsive Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make learner app routes usable on mobile and tablet by replacing the always-visible fixed sidebar with a responsive navigation model.

**Architecture:** Keep the existing desktop sidebar for `lg` screens and introduce a mobile header plus slide-over drawer for smaller screens. Reuse the existing learner navigation data so route visibility, feature flags, and account links stay consistent across desktop and mobile.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Playwright

---

### Task 1: Add a failing mobile-navigation regression test

**Files:**
- Modify: `web-saas/tests/e2e/auth-and-gating.spec.ts`
- Reference: `web-saas/tests/e2e/helpers/mockApi.ts`

**Step 1: Write the failing test**

Add a learner-authenticated Playwright test that:

1. Sets a mobile viewport
2. Visits `/app/dashboard`
3. Expects a visible menu button
4. Opens the drawer
5. Verifies learner nav links are available
6. Navigates to `/app/speaking`
7. Verifies the drawer can close and page content remains visible

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts --project=chromium`

Expected: FAIL because the mobile menu button/drawer does not exist.

### Task 2: Refactor learner navigation data into shared sections

**Files:**
- Modify: `web-saas/src/components/layout/LearnerShell.tsx`

**Step 1: Introduce navigation section helpers**

Extract:

- core dashboard item
- practice section
- assessment section
- library section
- account section

Keep existing feature-flag filtering and partner/advertiser links.

**Step 2: Run the failing test again**

Run: `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts --project=chromium`

Expected: still FAIL, but for missing responsive UI rather than data setup.

### Task 3: Implement responsive learner shell

**Files:**
- Modify: `web-saas/src/components/layout/LearnerShell.tsx`

**Step 1: Add mobile/tablet UI**

Implement:

- sticky mobile header with brand, current page title, theme toggle, and menu button
- slide-over drawer with navigation and account footer
- backdrop click + close button behavior
- close drawer on route change

Keep desktop behavior on `lg` and up.

**Step 2: Adjust main layout offsets**

Replace permanent `ml-[264px]` behavior with:

- `lg:ml-[264px]` on desktop
- no left margin on mobile/tablet
- mobile-safe content padding

**Step 3: Run focused test**

Run: `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts --project=chromium`

Expected: PASS

### Task 4: Verify broader learner coverage

**Files:**
- No code changes unless regressions found

**Step 1: Run shell-related smoke checks**

Run: `cd web-saas && npx playwright test tests/e2e/auth-and-gating.spec.ts tests/e2e/production-smoke.spec.ts --project=chromium`

Expected: PASS

**Step 2: Run typecheck**

Run: `cd web-saas && npm run typecheck`

Expected: PASS

### Task 5: Commit

**Step 1: Review diff**

Run: `git diff -- docs/plans/2026-03-06-learner-shell-responsive.md web-saas/src/components/layout/LearnerShell.tsx web-saas/tests/e2e/auth-and-gating.spec.ts`

**Step 2: Commit**

```bash
git add docs/plans/2026-03-06-learner-shell-responsive.md web-saas/src/components/layout/LearnerShell.tsx web-saas/tests/e2e/auth-and-gating.spec.ts
git commit -m "feat: make learner shell responsive"
```
