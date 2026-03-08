# Speaking Smooth Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prebuild the base examiner speaking session before live playback starts, remove candidate transcript processing from the critical path, and keep only deadline-bounded adaptive follow-ups live so the IELTS speaking simulation feels immediate and realistic.

**Architecture:** The backend will mark a session package as ready only after all base examiner segments are resolved and playable, then return a deterministic manifest to the web client. The web client will preload/decode the full base examiner queue before first playback, while candidate upload/transcription and adaptive follow-up generation run in the background with a strict fallback to the next prebuilt seed prompt.

**Tech Stack:** TypeScript, Node.js backend, React/Next.js, Supabase Storage/CDN, existing speech/transcription services, Jest, Playwright

---

### Task 1: Add backend tests for package-readiness gating

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.contract.test.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/dto/SpeakingSessionPackageDto.ts`

**Step 1: Write the failing tests**

Add cases that require:
- `startSimulation()` to return a package with a package-level readiness field
- all base segments in the returned package to be marked as ready before the live session starts
- controller response to include readiness metadata for the web client

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts test/unit/src/api/controllers/TestSimulationController.contract.test.ts --config=./jest.config.json
```

Expected: FAIL because the DTO and response contract do not yet expose package readiness.

**Step 3: Add minimal contract fields**

Add the smallest possible contract fields needed by the tests:
- package readiness status
- required segment count
- ready segment count

**Step 4: Run tests to verify they pass**

Run the same Jest command.

Expected: PASS for the new readiness contract cases.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.contract.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/dto/SpeakingSessionPackageDto.ts
git commit -m "test: add speaking package readiness contract"
```

### Task 2: Make session-package assembly block on required base assets

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeakingSessionPackageService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`

**Step 1: Write the failing tests**

Require:
- base fixed/check-in/seed segments cannot be considered ready when only fallback URLs exist
- the package builder marks missing required base assets as not ready
- `startSimulation()` waits for or rejects missing required base audio before exposing the live session

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json
```

Expected: FAIL because the package builder still treats fallback URLs as acceptable base readiness.

**Step 3: Implement the minimal readiness gate**

Implement:
- required-segment classification for base session segments
- explicit `isReady`/`requiresGeneration` flags on segments
- package-level readiness calculation
- `startSimulation()` behavior that blocks or fails before live runtime if required base assets are missing

**Step 4: Run tests to verify they pass**

Run the same Jest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeakingSessionPackageService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts
git commit -m "feat: gate speaking runtime on base audio readiness"
```

### Task 3: Add a web preparation phase and full base-audio preload

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/app/(learner)/app/speaking/page.tsx`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing web test**

Add coverage that requires:
- `Start Full Simulation` to enter a `Preparing your speaking test...` state before first examiner playback
- the runtime to preload the full base examiner package before the first examiner segment begins
- no `Loading examiner prompt`/`Preparing examiner audio` copy during a normal live turn

**Step 2: Run the failing test**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "prepares the full speaking session before the first examiner turn" --project=chromium
```

Expected: FAIL because the current stage still starts live playback without a strict preparation phase.

**Step 3: Implement the minimal preparation workflow**

Implement:
- setup-phase state in the stage
- full base-segment discovery from the session package
- preload/decode of all required base audio assets before first playback
- calmer setup copy during preparation only

**Step 4: Run the test to verify it passes**

Run the same Playwright command.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/app/(learner)/app/speaking/page.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: preload full base speaking audio before test start"
```

### Task 4: Remove base-turn live synthesis from the browser critical path

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing web test**

Require:
- no per-turn synthesis request for fixed/check-in/seed examiner turns after the live test has started
- replay for those turns uses cached session audio instead of a network synthesis call

**Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "reuses preloaded base examiner audio during live playback" --project=chromium
```

Expected: FAIL because the current client still allows base-turn synthesis fallbacks.

**Step 3: Implement the minimal runtime restriction**

Implement:
- base-turn classification in the runtime client
- hard prohibition on live synthesis for base fixed/check-in/seed segments during live playback
- replay routed through cached decoded audio for the active session

**Step 4: Run the test to verify it passes**

Run the same Playwright command.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: remove live synthesis from base speaking turns"
```

### Task 5: Decouple candidate stop from transcript completion

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing backend and web tests**

Require:
- candidate answer submission returns the next visible runtime state before transcript text is fully attached
- the web stage no longer shows transcript-processing text as a blocker between turns
- the learner sees a neutral transition state instead of a stalled submission wait

**Step 2: Run the failing tests**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json

cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "does not block the next speaking turn on transcript processing" --project=chromium
```

Expected: FAIL because transcript and turn resolution are still coupled.

**Step 3: Implement the minimal background-processing split**

Implement:
- backend candidate-turn persistence before transcript completion
- background transcript attachment/update path
- frontend neutral transition state copy
- transcript display updates after the turn has already advanced

**Step 4: Run the tests to verify they pass**

Run the same Jest and Playwright commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/lib/speaking/simulationRuntime.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: move speaking transcript processing off the critical path"
```

### Task 6: Add adaptive follow-up deadlines with silent fallback

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeechService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing tests**

Require:
- Part 1 and Part 3 adaptive follow-up waits no longer than the configured deadline
- if the adaptive follow-up misses deadline, runtime falls back to the next prebuilt seed question
- the learner does not see an error or loading state when fallback occurs

**Step 2: Run the failing tests**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json

cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "falls back to the next seed question when adaptive follow-up misses its deadline" --project=chromium
```

Expected: FAIL because adaptive follow-up can still block the path too long.

**Step 3: Implement the deadline policy**

Implement:
- backend follow-up deadline configuration
- fallback selection to the next seed prompt
- no user-facing error state for deadline expiry

**Step 4: Run the tests to verify they pass**

Run the same Jest and Playwright commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/SpeechService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: add deadline-bounded speaking follow-ups"
```

### Task 7: Auto-run Part 2 launch without live loading seams

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing web test**

Require:
- after Part 2 prep countdown ends, examiner plays `Please begin speaking now`
- recording auto-starts immediately after that launch line
- no examiner-loading copy appears in this Part 2 handoff

**Step 2: Run the failing test**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "runs the part 2 launch line and recording handoff without loading seams" --project=chromium
```

Expected: FAIL because Part 2 still has visible runtime seams.

**Step 3: Implement the minimal Part 2 polish**

Implement:
- Part 2 launch line sourced from preloaded base package
- automatic recording start immediately after launch playback ends
- no raw prep/loading text once launch begins

**Step 4: Run the test to verify it passes**

Run the same Playwright command.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: smooth part 2 speaking launch handoff"
```

### Task 8: Add telemetry and focused verification for the smooth-runtime target

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing checks**

Require:
- prepare-phase timing to be logged
- adaptive fallback path to be observable
- base-turn synthesis fallback rate to be assertable in tests

**Step 2: Run the failing test suite**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium
```

Expected: FAIL because the telemetry hooks/assertions are not yet present.

**Step 3: Implement minimal telemetry**

Add:
- setup timing markers
- base-turn live-synthesis fallback counters
- adaptive deadline hit/miss counters

**Step 4: Run the focused backend and web verification**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts test/unit/src/api/controllers/TestSimulationController.contract.test.ts --config=./jest.config.json

cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium
npm run typecheck
```

Expected:
- backend focused Jest suites PASS
- speaking Playwright suite PASS
- web typecheck PASS or any pre-existing unrelated failures called out explicitly

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/main-active/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "chore: instrument speaking smooth runtime metrics"
```
