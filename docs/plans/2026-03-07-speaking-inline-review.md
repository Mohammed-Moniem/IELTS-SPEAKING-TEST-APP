# Speaking Inline Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface speaking upload progress and practice feedback inside the active session workspace so learners immediately understand that audio is processing and can review results without scrolling far down the page.

**Architecture:** Keep the existing speaking practice data flow, but replace the current small recorder-state chip plus separate `Transcription` and `Practice Result` cards with one stateful inline review surface inside the active session container. Use the existing speaking history detail page as the drill-down destination and add focused browser coverage for upload, error, and result visibility.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, Playwright

---

### Task 1: Add failing browser coverage for the new speaking review flow

**Files:**
- Modify: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

Add coverage for:
- a prominent upload panel while audio processing is in flight
- an inline review section that stays in the active session area
- a visible `Open full report` CTA after feedback is ready

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "surfaces a prominent upload state and inline review after recording" --project=chromium`

Expected: FAIL because the current page still uses a small status chip and separate result cards.

**Step 3: Write minimal implementation**

Do not implement yet. Move to Task 2 after the failure is confirmed.

**Step 4: Run test to verify it passes**

Run the same command after Task 2.

**Step 5: Commit**

```bash
git add web-saas/tests/e2e/speaking-flow.spec.ts web-saas/app/(learner)/app/speaking/page.tsx docs/plans/2026-03-07-speaking-inline-review.md
git commit -m "feat: surface speaking inline upload and review states"
```

### Task 2: Refactor the speaking practice workspace into a guided inline review flow

**Files:**
- Modify: `web-saas/app/(learner)/app/speaking/page.tsx`
- Reference: `web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx`

**Step 1: Write the failing test**

Use the failing Playwright test from Task 1 as the gate.

**Step 2: Run test to verify it fails**

Reuse the Task 1 command.

**Step 3: Write minimal implementation**

Implement:
- a full-width upload/error status panel inside the active session workspace
- one inline review block that combines transcript, band summary, action items, and band breakdown
- a secondary `Open full report` link that points to the existing speaking history detail page
- state-driven scroll/focus to the workspace when processing or review content appears

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "surfaces a prominent upload state and inline review after recording|completes speaking practice with manual transcript fallback|refreshes audio upload auth and copies the transcription into the manual transcript field|surfaces upload timeout and allows manual transcript recovery|handles transcription failure with fallback transcript path" --project=chromium`

Expected: PASS.

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/speaking/page.tsx web-saas/tests/e2e/speaking-flow.spec.ts docs/plans/2026-03-07-speaking-inline-review.md
git commit -m "feat: improve speaking upload and inline review ux"
```

### Task 3: Verify the speaking flow remains stable

**Files:**
- Modify: none
- Test: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

No new test. Verification task only.

**Step 2: Run test to verify it fails**

Not applicable.

**Step 3: Write minimal implementation**

No implementation. Verification only.

**Step 4: Run test to verify it passes**

Run:
- `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium`
- `cd web-saas && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-speaking-inline-review.md
git commit -m "docs: record speaking inline review plan"
```
