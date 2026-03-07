# Speaking Workspace Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure speaking workspaces and results appear immediately in view when learners start practice, start a simulation, or run a quick evaluation.

**Architecture:** Keep the current speaking data flows, but move the active practice panel above the topic grid and add a shared ref-driven scroll/focus effect for surfaced practice, simulation, and quick-evaluation blocks. Verify the UX with a single Playwright regression in the existing speaking flow suite.

**Tech Stack:** Next.js App Router, React client components, Playwright, TypeScript

---

### Task 1: Add the failing UX regression

**Files:**
- Modify: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

- Add one test that:
  - opens `/app/speaking`
  - starts a practice topic and expects `Active Session` to be in the viewport
  - switches to `Simulation`, starts it, and expects `Simulation in Progress` to be in the viewport
  - switches to `Quick Evaluate`, submits a transcript, and expects `Evaluation` to be in the viewport

**Step 2: Run test to verify it fails**

Run: `cd web-saas && PLAYWRIGHT_PORT=3012 npx playwright test tests/e2e/speaking-flow.spec.ts -g "keeps speaking workspaces and results in view when actions start" --project=chromium`

Expected: FAIL because the current page does not surface those sections into view consistently.

### Task 2: Implement practice workspace surfacing

**Files:**
- Modify: `web-saas/app/(learner)/app/speaking/page.tsx`

**Step 1: Write minimal implementation**

- Add a ref for the practice session panel.
- Move the active practice session block above the topic grid and load-more control.
- When `practiceSession` becomes truthy, scroll and focus the panel.

**Step 2: Run targeted test**

Run the speaking-flow test again and confirm the practice portion passes or progresses further before failing.

### Task 3: Implement simulation and quick-evaluation surfacing

**Files:**
- Modify: `web-saas/app/(learner)/app/speaking/page.tsx`

**Step 1: Write minimal implementation**

- Add refs for the active simulation section and the quick-evaluation result block.
- When `simulation` becomes truthy, scroll/focus the simulation workspace.
- When `quickEvaluation` becomes truthy, scroll/focus the evaluation result.

**Step 2: Run targeted test**

Run: `cd web-saas && PLAYWRIGHT_PORT=3012 npx playwright test tests/e2e/speaking-flow.spec.ts -g "keeps speaking workspaces and results in view when actions start" --project=chromium`

Expected: PASS

### Task 4: Verify the broader speaking flow

**Files:**
- Modify: none unless failures reveal regressions

**Step 1: Run the full speaking flow spec**

Run: `cd web-saas && PLAYWRIGHT_PORT=3012 npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium`

Expected: PASS

**Step 2: Run typecheck**

Run: `cd web-saas && npm run typecheck`

Expected: PASS
