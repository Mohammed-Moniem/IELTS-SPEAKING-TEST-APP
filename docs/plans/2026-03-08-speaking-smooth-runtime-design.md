# Speaking Smooth Runtime Design

## Goal

Make the full IELTS speaking simulation feel like a controlled, realistic examiner-led test by preparing the known session upfront, removing live examiner-audio waits during the test, and moving candidate transcript processing out of the critical path.

## Decision Summary

We will move to a `prebuilt base session + non-blocking candidate pipeline + buffered adaptive follow-ups` runtime.

- The learner sees a short `Preparing your speaking test...` gate before the test begins.
- The backend prepares the whole base examiner package before playback starts.
- The client preloads the entire known examiner-audio manifest before the live test begins.
- During the live test, base examiner turns never wait on TTS or per-question audio API calls.
- Candidate audio transcription and answer analysis run in the background while the test keeps moving.
- Adaptive follow-ups remain supported in Part 1 and Part 3, but they get a strict deadline; if not ready quickly enough, the test continues with the next prebuilt question.

## Why The Current Runtime Still Feels Unnatural

The current experience is better than the original textarea-based flow, but it still exposes runtime machinery to the learner:

- examiner prompts can still wait on synthesis or per-segment fetches
- the UI can still show intermediate states like `Please listen to the examiner`
- candidate answer submission still waits for transcript + backend turn resolution before the next examiner action is ready
- base question playback and turn handoff still depend too much on live API timing

That is acceptable for a prototype, but not for a premium, realism-first speaking product.

## Product Requirements

The runtime should behave like a real test session:

1. Greeting and check-in
2. Identity-check sequence
3. Part 1 with a controlled sequence of seed questions, optionally one narrow follow-up
4. Automatic transition to Part 2
5. Part 2 cue card, 1-minute preparation, examiner launch line, candidate long turn
6. Automatic transition to Part 3
7. Part 3 seeded discussion, optionally one narrow follow-up
8. Automatic close and evaluation

The learner should not have to manually advance normal test flow.

## Scope

### In Scope

- Web + backend runtime improvements for smooth examiner playback
- Upfront session preparation gate
- Full preloading of all known base examiner turns
- Background candidate transcript processing
- Follow-up generation deadline with graceful fallback
- Stronger caching and storage usage for session audio assets

### Out Of Scope

- Changing Part 2 silence behavior
- Rewriting the full evaluation model in this slice
- Replacing the current report page again
- Unlimited adaptive branching
- A new mobile rewrite in this pass

## UX Target

### Before The Test Starts

The learner clicks `Start Full Simulation` and sees a calm preparation state:

- `Preparing your speaking test...`
- `Selecting your examiner`
- `Loading examiner audio`
- `Checking microphone access`

This lasts about 15 to 30 seconds, but the live test does not begin until the known base examiner turns are ready.

### During The Test

Once the test starts:

- examiner prompts should feel immediate
- the learner should never see raw loading text for base examiner turns
- the learner should not wait for transcript processing before the next examiner move becomes visible
- Part 2 should automatically run:
  - cue card prompt
  - prep countdown
  - examiner says `Please begin speaking now`
  - recording starts

### Candidate Guidance

The candidate should get explicit but lightweight guidance:

- Part 1 and Part 3:
  - `Recording starts automatically and submits after a short silence. Use Stop + Submit only if you want to finish early.`
- Part 2:
  - keep the long-turn behavior intact
  - do not auto-submit on silence in this slice

## Recommended Architecture

### 1. Prepare Gate Before First Playback

`startSimulation()` should no longer return as soon as the session record exists. It should only resolve the session as ready after:

- examiner profile is selected
- base segments are ordered
- asset resolution is complete for all required fixed and seed segments
- all known audio URLs are available
- the client has enough data to begin preloading immediately

This is a deliberate tradeoff: a slightly slower start for a much smoother test.

### 2. Base Session Package Must Be Fully Locked

The existing session package is the right foundation, but it needs stronger guarantees.

Required properties of the base package:

- one fixed examiner profile for the full session
- one deterministic ordered list of segments
- all check-in phrases resolved
- all Part 1 seed prompts resolved
- Part 2 cue-card and launch phrases resolved
- all Part 3 seed prompts resolved
- per-segment `audioUrl`, `audioAssetId`, `durationSeconds`, and readiness metadata
- package-level readiness status so the frontend knows the session is safe to start

The package should not rely on best-effort fallback URLs for the base live path. If an asset is required for the base path and is missing, the test should stay in the prepare gate until the asset is generated or fail early with a recoverable setup error before the live session begins.

### 3. Client Playback Uses A Queue, Not Live Synthesis

The client should play examiner audio from a prepared queue:

- preload the full known examiner package before first examiner playback
- decode/cache audio blobs in memory
- advance through the package locally for all non-adaptive base turns
- keep `Replay prompt` available off the cached audio blob

That means no base-turn `synthesizeSimulationSegment()` call during the live test.

### 4. Candidate Processing Becomes Non-Blocking

The current runtime still couples:

- candidate stop
- audio upload
- transcription
- follow-up resolution
- next turn visibility

Those should be split.

New behavior:

- once the learner stops, candidate audio uploads immediately
- transcription starts in the background
- the UI moves into a short neutral transition state without blocking the conversation
- the next examiner step is selected from one of two paths:
  - prebuilt next seed segment
  - adaptive follow-up if it is ready within deadline

The learner should not wait on transcript text appearing before the test continues.

### 5. Adaptive Follow-Ups Get A Deadline

Adaptive follow-up is valuable, but it cannot be allowed to stall the test.

Rule:

- Part 1: at most one adaptive follow-up
- Part 3: at most one adaptive follow-up
- adaptive response generation and TTS happen while the learner is answering
- if the follow-up is ready within about 1 to 1.5 seconds after candidate stop, use it
- otherwise skip it and continue with the next prebuilt seed question

This preserves adaptivity without sacrificing test smoothness.

### 6. Cache And Reuse Everything Possible

We should treat speaking delivery as an asset-delivery problem, not a live-generation problem.

Cache layers:

- permanent base audio assets in storage/CDN
- in-memory browser audio blob cache for the current session
- optional service-worker/browser-cache reuse for repeated assets
- adaptive follow-up asset cache keyed by:
  - examiner profile
  - normalized follow-up text
  - prompt context hash

This reduces repeated synthesis cost and improves perceived speed.

## Backend Runtime Changes

### Session Start

`TestSimulationService.startSimulation()` should:

1. select examiner profile
2. assemble ordered base session package
3. verify/generate any missing required base assets
4. mark package ready only when the full base path is playable
5. return the live session with `prepareStatus`

### Candidate Submission

`submitRuntimeAnswer()` should stop being the place where the learner waits.

It should:

1. accept the recorded audio + current turn
2. persist the candidate turn quickly
3. queue or launch transcription in the background
4. decide the next visible turn using:
   - buffered adaptive follow-up if ready
   - otherwise next prebuilt seed prompt
5. return the next runtime state fast

The transcript can finish and attach to the session afterward.

### Evaluation

Per-turn transcript and scoring should continue in the background so the conversation keeps moving.

The final evaluation screen can wait on the evaluation pipeline, but the live conversation should not.

## Frontend Runtime Changes

### Preparation Phase

The stage should show a real setup phase before playback:

- microphone priming
- package download
- audio prefetch/decode progress
- examiner ready state

### Live Phase

The stage should:

- only expose examiner speaking once audio is already ready
- switch into candidate turn immediately after prompt playback
- auto-start Part 1 and Part 3 candidate recording as today
- continue Part 2 with the examiner launch prompt and automatic recording start
- avoid showing raw processing/loading copy during live turns

### Transition Copy

Use only human test-like phrasing:

- `Please listen to the examiner.`
- `Your answer is being captured.`
- `Moving to the next question.`

Do not surface:

- `Loading examiner prompt`
- `Preparing examiner audio`
- `Transcribing your response...`

for the live conversation path.

## Failure Handling

### Before The Test Starts

If required base assets are missing or generation fails, the user should see a setup error before the test begins, not a broken live turn.

### During The Test

If candidate upload/transcription fails:

- keep the session paused in a controlled retryable state
- do not continue to examiner follow-up using bad or empty input

If adaptive follow-up misses its deadline:

- do not show an error
- simply continue with the next prebuilt examiner question

## Telemetry And Performance Targets

Track:

- package prepare time
- percent of sessions fully package-ready before start
- base-turn handoff latency
- candidate stop -> next visible examiner action
- adaptive follow-up hit rate
- adaptive follow-up timeout fallback rate
- base-turn live-synthesis fallback rate

Targets:

- start click -> ready to begin: under 30 seconds
- base examiner handoff: under 150 ms
- candidate stop -> next visible turn: under 500 ms
- adaptive follow-up deadline: 1.0 second target, 1.5 second hard cutoff
- base-turn live-synthesis fallback during live test: 0

## Acceptance Criteria

1. The learner never sees raw examiner-loading text during a normal live test.
2. All fixed/check-in/seed prompts for the session are prepared before playback begins.
3. Base examiner turns do not require per-turn synthesis during the live test.
4. Part 2 automatically transitions from prep countdown into `Please begin speaking now` and then recording.
5. Candidate transcript processing does not visibly block the next turn selection.
6. Adaptive follow-ups never stall the test; missed deadlines fall back silently to the next seed question.
7. Part 1 and Part 3 still auto-submit after silence.
8. Replay uses already-cached audio for the active session.
9. If required base assets are missing, the test fails before live playback, not in the middle of a turn.

## Recommendation

Ship this as an incremental architecture refinement on top of the current runtime, not a rewrite.

That keeps the examiner-led experience you already recovered, but removes the remaining unnatural pauses and runtime seams that are still visible to the learner.
