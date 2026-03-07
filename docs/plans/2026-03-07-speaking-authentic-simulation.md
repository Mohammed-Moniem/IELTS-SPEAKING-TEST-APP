# Speaking Authentic Simulation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the examiner-led full IELTS speaking simulation on web and mobile so learners complete a realistic voice-first test instead of filling part-by-part text forms.

**Architecture:** Introduce a backend-owned speaking simulation runtime that tracks fixed examiner segments, adaptive follow-up turns, learner recordings, retryable hard-pause states, and final evaluation. Keep the clients thin: web and mobile render the current runtime state, play examiner audio, capture learner audio, and advance only through explicit runtime actions.

**Tech Stack:** Node.js TypeScript backend, Next.js App Router, React Native Expo, ElevenLabs/OpenAI TTS via existing speech APIs, Playwright, Jest, React Native Testing Library

---

### Task 1: Lock the backend runtime contract with failing tests

**Files:**
- Modify: `micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts`
- Create: `micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Reference: `micro-service-boilerplate-main/src/api/services/SpeechService.ts`
- Reference: `micro-service-boilerplate-main/src/api/controllers/TestSimulationController.ts`

**Step 1: Write the failing test**

Add tests that describe the new runtime contract:

```ts
it("starts a session in intro-examiner state with a cached phrase segment", async () => {
  const runtime = await service.startRuntime(userId, headers);
  expect(runtime.state).toBe("intro-examiner");
  expect(runtime.currentSegment.kind).toBe("cached_phrase");
});

it("moves to paused-retryable when transcription fails", async () => {
  await service.answerTurn(userId, simulationId, failingAudio, headers);
  const runtime = await service.getRuntime(userId, simulationId);
  expect(runtime.state).toBe("paused-retryable");
  expect(runtime.retryCount).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd micro-service-boilerplate-main && npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json`

Expected: FAIL because the runtime service and DTO fields do not exist yet.

**Step 3: Write minimal implementation**

Add runtime state definitions and a minimal backend service layer that can:
- start in `intro-examiner`
- persist runtime state on the simulation record
- expose the current segment and retry counters

**Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

**Step 5: Commit**

```bash
git add micro-service-boilerplate-main/src/api/services/TestSimulationService.ts micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts docs/plans/2026-03-07-speaking-authentic-simulation.md docs/plans/2026-03-07-speaking-authentic-simulation-design.md
git commit -m "feat: add speaking simulation runtime contract"
```

### Task 2: Add shared examiner phrase catalog and cached-audio support

**Files:**
- Modify: `micro-service-boilerplate-main/src/api/services/SpeechService.ts`
- Create: `micro-service-boilerplate-main/src/api/services/ExaminerPhraseService.ts`
- Modify: `mobile/src/services/audioCacheService.ts`
- Modify: `mobile/src/services/textToSpeechService.ts`
- Create: `micro-service-boilerplate-main/test/unit/src/api/services/ExaminerPhraseService.test.ts`

**Step 1: Write the failing test**

Add tests for fixed phrase lookup and cacheability:

```ts
it("returns a fixed phrase for the intro passport request", () => {
  expect(service.getPhrase("id_check").text).toContain("identification document");
});

it("marks repeated phrases as cacheable", () => {
  expect(service.getPhrase("part2_intro").cacheable).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `cd micro-service-boilerplate-main && npx jest --no-cache --runInBand test/unit/src/api/services/ExaminerPhraseService.test.ts --config=./jest.config.json`

Expected: FAIL because the phrase service does not exist.

**Step 3: Write minimal implementation**

Implement one shared phrase catalog for:
- greeting
- full name request
- passport request
- part transitions
- full-test close

Update mobile cache code to key from those ids instead of only raw text where practical.

**Step 4: Run test to verify it passes**

Run the same backend test, then:

Run: `cd mobile && npm test -- --runInBand src/utils/errors.test.ts`

Expected: PASS, with no regression in the existing mobile speech fallback path.

**Step 5: Commit**

```bash
git add micro-service-boilerplate-main/src/api/services/SpeechService.ts micro-service-boilerplate-main/src/api/services/ExaminerPhraseService.ts micro-service-boilerplate-main/test/unit/src/api/services/ExaminerPhraseService.test.ts mobile/src/services/audioCacheService.ts mobile/src/services/textToSpeechService.ts
git commit -m "feat: add cached examiner phrase catalog"
```

### Task 3: Implement backend runtime actions for examiner turns, learner turns, and retryable pauses

**Files:**
- Modify: `micro-service-boilerplate-main/src/api/controllers/TestSimulationController.ts`
- Modify: `micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `micro-service-boilerplate-main/src/api/models/TestSimulationModel.ts`
- Modify: `micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts`
- Create: `micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.runtime.test.ts`
- Reference: `micro-service-boilerplate-main/src/api/controllers/SpeechController.ts`
- Reference: `micro-service-boilerplate-main/src/api/services/TranscriptionService.ts`

**Step 1: Write the failing test**

Add controller/service tests for:

```ts
it("accepts an answer turn and returns the next examiner segment", async () => {
  const response = await controller.answerTurn(req, res, params, file);
  expect(response.data.state).toBe("part1-examiner");
});

it("ends the session after a second failure on the same step", async () => {
  await service.registerStepFailure(userId, simulationId, "transcription");
  await expect(service.registerStepFailure(userId, simulationId, "transcription")).rejects.toThrow("restart");
});
```

**Step 2: Run test to verify it fails**

Run: `cd micro-service-boilerplate-main && npx jest --no-cache --runInBand test/unit/src/api/controllers/TestSimulationController.runtime.test.ts --config=./jest.config.json`

Expected: FAIL because runtime endpoints and pause handling are missing.

**Step 3: Write minimal implementation**

Add runtime endpoints such as:
- start / get runtime
- acknowledge examiner segment completion
- upload learner turn audio
- retry failed step
- abort failed test

Use existing `speech/transcribe`, `speech/examiner/chat`, and full-test evaluation pieces instead of duplicating speech logic.

**Step 4: Run test to verify it passes**

Run the same Jest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add micro-service-boilerplate-main/src/api/controllers/TestSimulationController.ts micro-service-boilerplate-main/src/api/services/TestSimulationService.ts micro-service-boilerplate-main/src/api/models/TestSimulationModel.ts micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.runtime.test.ts
git commit -m "feat: add speaking simulation runtime actions"
```

### Task 4: Replace the web full simulation form with an examiner-led stage

**Files:**
- Modify: `web-saas/app/(learner)/app/speaking/page.tsx`
- Create: `web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Create: `web-saas/src/lib/speaking/simulationRuntime.ts`
- Modify: `web-saas/src/lib/types.ts`
- Modify: `web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing test**

Add Playwright coverage for the examiner-led flow:

```ts
test("runs full simulation as examiner audio plus learner turns", async ({ page }) => {
  await page.goto("/app/speaking");
  await page.getByRole("button", { name: "Start Full Simulation" }).click();
  await expect(page.getByText("Examiner speaking")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
```

Also add checks for:
- learner controls locked during examiner speech
- `Your turn` mic stage after examiner finishes
- visible hard-pause state on runtime failure

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "runs full simulation as examiner audio plus learner turns" --project=chromium`

Expected: FAIL because the page still renders the form-based part textarea flow.

**Step 3: Write minimal implementation**

Implement a dedicated web stage component that:
- fetches and renders runtime state
- plays examiner audio
- shows subtitles/transcript for the current examiner segment
- unlocks mic capture only during learner turns
- removes part textareas and part-jump controls from the live simulation

**Step 4: Run test to verify it passes**

Run:
- `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "runs full simulation as examiner audio plus learner turns|shows a retryable pause when a simulation step fails" --project=chromium`
- `cd web-saas && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add web-saas/app/(learner)/app/speaking/page.tsx web-saas/src/components/speaking/AuthenticSimulationStage.tsx web-saas/src/lib/speaking/simulationRuntime.ts web-saas/src/lib/types.ts web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: restore examiner-led speaking simulation on web"
```

### Task 5: Restore the mobile full-test screen to the shared runtime

**Files:**
- Modify: `mobile/src/screens/FullTest/FullTestScreen.tsx`
- Modify: `mobile/src/components/AuthenticFullTestV2.tsx`
- Modify: `mobile/src/components/SimulationMode.tsx`
- Modify: `mobile/src/api/speechApi.ts`
- Create: `mobile/src/components/__tests__/AuthenticFullTestV2.test.tsx`

**Step 1: Write the failing test**

Add React Native Testing Library coverage for the stage progression:

```tsx
it("shows examiner speaking before enabling the learner mic", async () => {
  render(<AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />);
  expect(screen.getByText(/examiner speaking/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /start recording/i })).toBeDisabled();
});
```

Add coverage for:
- Part 2 prep countdown
- retryable pause UI
- no manual text entry during the simulation

**Step 2: Run test to verify it fails**

Run: `cd mobile && npm test -- --runInBand src/components/__tests__/AuthenticFullTestV2.test.tsx`

Expected: FAIL because the restored shared runtime behavior is not wired yet.

**Step 3: Write minimal implementation**

Refactor the mobile full-test screen to:
- consume the same backend runtime states as web
- play cached examiner phrases and dynamic TTS
- gate learner mic turns by runtime state
- remove any remaining manual response path from full simulation

**Step 4: Run test to verify it passes**

Run:
- `cd mobile && npm test -- --runInBand src/components/__tests__/AuthenticFullTestV2.test.tsx`
- `cd mobile && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add mobile/src/screens/FullTest/FullTestScreen.tsx mobile/src/components/AuthenticFullTestV2.tsx mobile/src/components/SimulationMode.tsx mobile/src/api/speechApi.ts mobile/src/components/__tests__/AuthenticFullTestV2.test.tsx
git commit -m "feat: restore authentic speaking simulation on mobile"
```

### Task 6: Rewire final full-test evaluation and report rendering to the runtime outputs

**Files:**
- Modify: `micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx`
- Modify: `web-saas/tests/e2e/speaking-flow.spec.ts`
- Create: `micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationEvaluation.test.ts`

**Step 1: Write the failing test**

Add backend and browser checks for:
- full-test evaluation receives all recorded turns
- report page shows part-grouped transcript evidence
- report page shows adaptive discussion context instead of one response blob

```ts
it("aggregates all runtime turns into a full speaking evaluation", async () => {
  const result = await service.completeRuntime(userId, simulationId, headers);
  expect(result.overallFeedback.summary).toContain("speaking simulation");
  expect(result.parts[0].turns.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run:
- `cd micro-service-boilerplate-main && npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationEvaluation.test.ts --config=./jest.config.json`
- `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts -g "shows a full speaking report after examiner-led simulation" --project=chromium`

Expected: FAIL because the current completion path still assumes one response per part.

**Step 3: Write minimal implementation**

Update completion and report rendering so the final report can show:
- turn-by-turn transcript evidence
- grouped part summaries
- final overall band and coaching guidance

**Step 4: Run test to verify it passes**

Run the same commands plus:

Run: `cd web-saas && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add micro-service-boilerplate-main/src/api/services/TestSimulationService.ts micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationEvaluation.test.ts web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: evaluate and render examiner-led full speaking tests"
```

### Task 7: Run end-to-end verification across backend, web, and mobile

**Files:**
- Modify: none
- Test: `micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Test: `micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.runtime.test.ts`
- Test: `micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationEvaluation.test.ts`
- Test: `web-saas/tests/e2e/speaking-flow.spec.ts`
- Test: `mobile/src/components/__tests__/AuthenticFullTestV2.test.tsx`

**Step 1: Write the failing test**

No new test. Verification only.

**Step 2: Run test to verify it fails**

Not applicable.

**Step 3: Write minimal implementation**

No implementation. Verification only.

**Step 4: Run test to verify it passes**

Run:
- `cd micro-service-boilerplate-main && npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts test/unit/src/api/controllers/TestSimulationController.runtime.test.ts test/unit/src/api/services/TestSimulationEvaluation.test.ts --config=./jest.config.json`
- `cd web-saas && npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium`
- `cd web-saas && npm run typecheck`
- `cd mobile && npm test -- --runInBand src/components/__tests__/AuthenticFullTestV2.test.tsx`
- `cd mobile && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-speaking-authentic-simulation.md docs/plans/2026-03-07-speaking-authentic-simulation-design.md
git commit -m "docs: record authentic speaking simulation execution plan"
```

### Task 8: Verify the live backend target before implementation

**Files:**
- Modify: none
- Reference: `.claude/worktrees/web-brand-mobile-learner/micro-service-boilerplate-main`

**Step 1: Write the failing test**

No product test. Environment verification only.

**Step 2: Run test to verify it fails**

Run:
- `lsof -iTCP:4000 -sTCP:LISTEN`
- `pwd`

Expected: confirm whether local `:4000` is serving from `micro-service-boilerplate-main` or the `.claude/worktrees/...` backend copy.

**Step 3: Write minimal implementation**

If local backend is serving from the worktree copy, either:
- restart local backend from the main repo before implementation, or
- mirror backend changes into the active worktree during implementation so web/mobile testing uses the edited runtime.

**Step 4: Run test to verify it passes**

Run: `curl -s http://127.0.0.1:4000/api/v1/health`

Expected: healthy backend from the codebase being edited.

**Step 5: Commit**

No commit. Environment setup only.
