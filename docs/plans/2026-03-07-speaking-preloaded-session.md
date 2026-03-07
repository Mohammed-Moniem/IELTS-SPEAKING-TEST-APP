# Speaking Preloaded Session Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a preloaded examiner-led IELTS speaking session package that uses reusable Supabase-hosted audio assets for all fixed and bank-based prompts, while keeping only adaptive follow-ups live-generated.

**Architecture:** The backend will assemble a full session manifest before the learner starts, selecting one examiner profile, resolving prebuilt audio assets, and exposing a deterministic runtime package to both web and mobile. Clients will execute that manifest locally, preload upcoming audio segments, and only call back to the server for learner transcription, evaluation, and buffered adaptive follow-up generation.

**Tech Stack:** TypeScript, Node.js backend, Supabase Storage, OpenAI TTS, existing speech/transcription endpoints, React/Next.js web app, React Native mobile app, Jest, Playwright

---

### Task 1: Define the session-package and audio-asset contracts

**Files:**
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/dto/SpeakingSessionPackageDto.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/models/SpeakingAudioAssetModel.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/models/TestSimulationModel.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`

**Step 1: Write the failing contract tests**

Add test cases that require:
- `sessionPackage.examinerProfile`
- `sessionPackage.segments[]`
- `segment.audioAssetId`
- `segment.audioUrl`
- `segment.turnType`
- `segment.part`
- `segment.canAutoAdvance`

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json
```

Expected: FAIL because the new DTO/model fields do not exist yet.

**Step 3: Add minimal DTO and model types**

Define:
- `SpeakingExaminerProfile`
- `SpeakingAudioAssetRef`
- `SpeakingSessionSegment`
- `SpeakingSessionPackage`

Persist package metadata on `TestSimulationModel`.

**Step 4: Run tests to verify they pass**

Run the same Jest command.

Expected: PASS for the new contract cases.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/dto/SpeakingSessionPackageDto.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/models/SpeakingAudioAssetModel.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/dto/TestSimulationDto.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/models/TestSimulationModel.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts
git commit -m "feat: add speaking session package contracts"
```

### Task 2: Add examiner-profile and audio-asset lookup services

**Files:**
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingExaminerProfileService.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/ExaminerPhraseService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/env.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/ExaminerPhraseService.test.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/SpeakingAudioAssetService.test.ts`

**Step 1: Write failing tests**

Require:
- deterministic profile selection for `auto`
- supported profile list contains `british`, `australian`, `north-american`
- asset lookup returns existing fixed/question assets by normalized cache key

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/ExaminerPhraseService.test.ts test/unit/src/api/services/SpeakingAudioAssetService.test.ts --config=./jest.config.json
```

Expected: FAIL because the new services are missing.

**Step 3: Implement minimal services**

Add:
- examiner profile catalog
- `auto` selection helper
- normalized cache-key generation
- fixed-phrase asset lookup
- bank-question asset lookup

**Step 4: Run tests to verify they pass**

Run the same command.

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingExaminerProfileService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/ExaminerPhraseService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/env.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/ExaminerPhraseService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/SpeakingAudioAssetService.test.ts
git commit -m "feat: add speaking examiner profiles and asset lookup"
```

### Task 3: Build the offline speaking audio prebuild pipeline

**Files:**
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen/export-prompts.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen/synthesize-audio.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen/upload-audio.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen/register-assets.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen/run-pipeline.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/package.json`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/scripts/speaking-gen/export-prompts.test.ts`

**Step 1: Write the failing export test**

Require the exporter to emit:
- fixed examiner lines
- Part 1 bank prompts
- Part 2 cue card prompts
- Part 3 bank prompts
- normalized cache keys per voice profile

**Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/scripts/speaking-gen/export-prompts.test.ts --config=./jest.config.json
```

Expected: FAIL because the pipeline does not exist.

**Step 3: Implement the export and synthesis pipeline**

Use the existing listening pipeline as the reference shape, but switch synthesis to OpenAI TTS through a reusable helper rather than ElevenLabs runtime calls.

**Step 4: Run the export test again**

Expected: PASS.

**Step 5: Smoke-run the pipeline against a small fixture**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
node -r ts-node/register scripts/speaking-gen/run-pipeline.ts --limit 5 --voice-profile british
```

Expected: prompt export, synthesis, upload, and registration complete for a tiny sample.

**Step 6: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/speaking-gen \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/package.json \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/scripts/speaking-gen/export-prompts.test.ts
git commit -m "feat: add speaking audio prebuild pipeline"
```

### Task 4: Assemble a prebuilt session package at simulation start

**Files:**
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingSessionPackageService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/controllers/TestSimulationController.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.contract.test.ts`

**Step 1: Write failing runtime/controller tests**

Require:
- start simulation returns `sessionPackage`
- first examiner segment includes pre-resolved audio asset URL
- Part 1 contains a bounded number of base prompts
- Part 3 contains a bounded number of base prompts

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts test/unit/src/api/controllers/TestSimulationController.contract.test.ts --config=./jest.config.json
```

Expected: FAIL because start does not yet build the package.

**Step 3: Implement the package assembler**

Build:
- examiner profile selection
- phrase resolution
- question-bank selection
- segment ordering
- storage URL lookup
- session metadata persistence

**Step 4: Run tests again**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingSessionPackageService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/controllers/TestSimulationController.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/controllers/TestSimulationController.contract.test.ts
git commit -m "feat: build preloaded speaking session package"
```

### Task 5: Add buffered adaptive follow-up generation and caching

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeechService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/SpeechService.test.ts`

**Step 1: Write failing tests**

Require:
- follow-up generation only for Part 1 and Part 3
- at most one narrow follow-up before returning to planned progression
- synthesized follow-up gets cached and reused by normalized text + voice profile

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts test/unit/src/api/services/SpeechService.test.ts --config=./jest.config.json
```

Expected: FAIL because follow-up buffering/caching is not package-aware.

**Step 3: Implement buffered follow-up generation**

During learner answer processing:
- generate follow-up text if allowed
- synthesize the next audio asset immediately
- persist cache metadata
- attach the resulting segment back onto the active package

**Step 4: Run tests again**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeechService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeakingAudioAssetService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/TestSimulationRuntimeService.test.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/test/unit/src/api/services/SpeechService.test.ts
git commit -m "feat: buffer and cache speaking follow-up audio"
```

### Task 6: Move the web runtime to package-first playback

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/src/lib/speaking/simulationRuntime.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/src/components/speaking/AuthenticSimulationStage.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/app/(learner)/app/speaking/page.tsx`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/tests/e2e/speaking-flow.spec.ts`

**Step 1: Write the failing browser tests**

Require:
- `Start Full Simulation` shows a preparation state
- first examiner segment plays from a package audio URL
- no visible “Preparing examiner audio...” for package-backed base prompts
- part transitions occur without manual clicks

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts -g "preloaded speaking package" --project=chromium
```

Expected: FAIL because the client still synthesizes most prompts live.

**Step 3: Implement package-first playback**

Change the web client to:
- fetch the session package on start
- preload upcoming audio URLs
- play base examiner turns directly from storage
- reserve `/speech/synthesize` only for uncached dynamic follow-ups

**Step 4: Run the Playwright tests again**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/src/lib/speaking/simulationRuntime.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/src/components/speaking/AuthenticSimulationStage.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/app/(learner)/app/speaking/page.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/tests/e2e/speaking-flow.spec.ts
git commit -m "feat: use preloaded speaking session package on web"
```

### Task 7: Move the mobile runtime to package-first playback

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/api/services.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/types/api.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.tsx`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/services/textToSpeechService.ts`
- Test: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.test.tsx`

**Step 1: Write the failing mobile tests**

Require:
- session start returns a package and examiner profile
- mobile preloads upcoming base prompt audio
- playback uses package assets before remote synthesis
- adaptive follow-up still works after a learner turn

**Step 2: Run the tests to verify they fail**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile
npm test -- --runInBand src/components/AuthenticFullTestV2.test.tsx
```

Expected: FAIL because mobile still treats prompts as live speech events first.

**Step 3: Implement package-first mobile playback**

Use the package manifest for:
- fixed lines
- seed prompt audio
- part transitions
- next-segment preloading

Keep existing mobile audio-session discipline for recording/playback switching.

**Step 4: Run the tests again**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/api/services.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/types/api.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.tsx \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/services/textToSpeechService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.test.tsx
git commit -m "feat: use preloaded speaking session package on mobile"
```

### Task 8: Add telemetry, performance checks, and migration cleanup

**Files:**
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeechService.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts`
- Create: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/speaking-preload-baseline.md`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/tests/e2e/speaking-flow.spec.ts`
- Modify: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.test.tsx`

**Step 1: Write failing telemetry assertions**

Require telemetry fields for:
- package build duration
- base asset hit/miss count
- follow-up cache hit/miss count
- examiner profile used

**Step 2: Run targeted tests to confirm missing telemetry**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json
```

Expected: FAIL because the metrics are not emitted yet.

**Step 3: Implement telemetry and migration cleanup**

Add:
- package timing logs
- cache-hit metrics
- optional feature flag to disable ElevenLabs hot-path usage
- docs on how to measure package warm/cold start times

**Step 4: Run verification**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile
npm test -- --runInBand src/components/AuthenticFullTestV2.test.tsx
```

Expected: PASS across backend, web, and mobile targeted suites.

**Step 5: Commit**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/SpeechService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/src/api/services/TestSimulationService.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/speaking-preload-baseline.md \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/tests/e2e/speaking-flow.spec.ts \
        /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile/src/components/AuthenticFullTestV2.test.tsx
git commit -m "chore: instrument and verify preloaded speaking runtime"
```

### Task 9: Run manual end-to-end verification with a real learner account

**Files:**
- Document results in: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/docs/plans/2026-03-07-speaking-preloaded-session-design.md`

**Step 1: Run backend and clients**

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main && npm run dev
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas && npm run dev
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile && npm start
```

**Step 2: Verify the learner journey**

Check:
- package preparation time
- first prompt playback
- Part 1 auto progression
- Part 2 prep countdown
- Part 2 long turn
- Part 3 discussion
- final report generation

**Step 3: Record any defects before declaring complete**

Add notes to the design doc or a follow-up log if anything still stalls or feels artificial.

**Step 4: Commit the verification notes**

```bash
git add /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/docs/plans/2026-03-07-speaking-preloaded-session-design.md
git commit -m "docs: record speaking preload verification notes"
```
