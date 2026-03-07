# Speaking Report Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the speaking full-report page into a real coaching debrief that clearly shows the learner transcript, explains the score, and includes a stronger-answer example plus next-step actions.

**Architecture:** Keep the existing speaking detail route and API contract, but restructure the page around a report hero, plain-language explanation, adaptive transcript section, stronger-answer example, and next-step CTA zone. Because the current API does not return a model answer, the first pass will generate an honest frontend coaching example/outline from the existing prompt, transcript, and improvement signals.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind CSS, Playwright

---

### Task 1: Add failing browser coverage for the report-page structure

**Files:**
- Modify: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

Add a report-page test that expects:
- a real report hero
- a clearly labeled `Your transcript` section
- an `Example stronger answer` section
- at least one actionable CTA such as `Retry this prompt`

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "renders the speaking full report as a coaching debrief" --project=chromium`

Expected: FAIL because the current page still renders the sparse transcript/band-insights split.

**Step 3: Write minimal implementation**

Do not implement yet.

**Step 4: Run test to verify it passes**

Reuse the same command after Task 2.

**Step 5: Commit**

```bash
git add web-saas/tests/e2e/speaking-flow.spec.ts web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx docs/plans/2026-03-07-speaking-report-page-redesign.md
git commit -m "feat: redesign speaking report page"
```

### Task 2: Refactor the report page into a coaching debrief

**Files:**
- Modify: `web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx`
- Reference: `web-saas/app/(learner)/app/speaking/page.tsx`
- Reference: `web-saas/app/(learner)/app/writing/history/[submissionId]/page.tsx`

**Step 1: Write the failing test**

Use the Task 1 Playwright test as the gate.

**Step 2: Run test to verify it fails**

Reuse the Task 1 command.

**Step 3: Write minimal implementation**

Implement:
- a report hero with prompt, overall band, verdict, metadata, and primary CTA
- a `Why this score happened` section based on summary/improvements/breakdown
- a clearly labeled `Your transcript` section that adapts to short or long answers
- an `Example stronger answer` or stronger-answer outline derived from existing prompt/feedback
- a next-step action block with targeted retry/practice/library actions
- improved empty-state wording for weak or sparse responses

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "renders the speaking full report as a coaching debrief|completes speaking practice with manual transcript fallback" --project=chromium`

Expected: PASS.

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx web-saas/tests/e2e/speaking-flow.spec.ts docs/plans/2026-03-07-speaking-report-page-redesign.md
git commit -m "feat: improve speaking report learning value"
```

### Task 3: Verify report and speaking flows still work

**Files:**
- Modify: none
- Test: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

No new test.

**Step 2: Run test to verify it fails**

Not applicable.

**Step 3: Write minimal implementation**

No implementation.

**Step 4: Run test to verify it passes**

Run:
- `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium`
- `cd web-saas && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-speaking-report-page-redesign.md
git commit -m "docs: record speaking report page plan"
```
