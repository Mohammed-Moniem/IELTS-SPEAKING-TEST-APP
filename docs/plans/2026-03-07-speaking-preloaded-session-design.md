# Speaking Preloaded Session Design

## Goal

Replace the fragile live-per-prompt speaking runtime with a prebuilt examiner-led session package that feels much closer to a real IELTS Speaking test on both web and mobile, while materially reducing recurring TTS cost.

## Decision Summary

We will move to a `prebuilt session package + buffered adaptive follow-ups` model.

- The backend assembles the full base test before the learner starts.
- All fixed examiner lines and all bank-based seed prompts are pre-generated as reusable audio assets.
- Each simulation uses one examiner profile for the whole session.
- Only adaptive follow-ups remain live-generated, and those are synthesized one turn ahead while the learner is answering.
- Audio assets are stored and delivered through Supabase Storage/CDN.
- OpenAI TTS becomes the primary production synthesis engine. ElevenLabs is removed from the hot path.

## Why The Current Model Falls Short

The current full speaking simulation still behaves like a runtime improvisation engine:

- each examiner prompt can depend on synthesis latency
- handoff timing depends on client playback events
- part transitions are not deterministic enough
- resume/recovery is harder because there is no full ordered session manifest
- the learner can feel timing glitches, prompt gaps, or inconsistent turn changes

That is the wrong architecture for a premium “real test” experience.

## Product Requirements

The speaking simulation should feel like one controlled examiner-led session:

1. Greeting and identity check
2. Part 1 with roughly 4 to 5 examiner questions
3. Automatic transition to Part 2
4. Part 2 cue card, 1 minute prep, 1 to 2 minute long turn
5. Automatic transition to Part 3
6. Part 3 with roughly 3 to 4 examiner questions
7. Final close and evaluation

The learner should not need to manually advance the test except in explicit recovery states.

## Official Test Shape

Reference format:

- Part 1: introduction/interview, roughly 4 to 5 minutes
- Part 2: 1 minute preparation, 1 to 2 minute long turn
- Part 3: discussion, roughly 4 to 5 minutes

Sources:

- [IELTS.org speaking format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking)
- [British Council IELTS format](https://takeielts.britishcouncil.org/take-ielts/test-format)

## Options Considered

### 1. Recommended: Prebuilt Session Package + Buffered Follow-Ups

Build the whole base test at session start:

- examiner profile
- fixed script lines
- Part 1 seed questions
- Part 2 cue card prompt
- Part 3 seed questions
- transition phrases
- timing metadata
- ordered playback manifest

Then generate only adaptive follow-ups during the live run, one turn ahead.

Why this wins:

- tight control over playback and timing
- consistent examiner voice for the entire session
- fast client-side transitions
- much lower recurring TTS cost
- still preserves the adaptive examiner differentiator

### 2. Fully Pre-rendered Linear Test

Generate everything ahead of time with no adaptive follow-ups.

Pros:

- simplest runtime
- smoothest technically

Cons:

- weakens the core product advantage
- feels less responsive and less examiner-like

### 3. Keep Live Runtime But Cache More

Continue generating prompts during the test, with more caching and handoff fixes.

Pros:

- least rewrite

Cons:

- still too dependent on runtime synthesis
- still prone to timing drift
- still hard to resume cleanly

## Examiner Voice Strategy

### Recommendation

Use `auto examiner` by default.

- The system chooses one examiner profile when the test package is created.
- That profile stays fixed for the entire simulation.
- The learner does not choose an accent before each run.
- A settings-level override can be added later.

### Launch Profile Set

Start with three profiles:

- British
- Australian
- North American

Expand later:

- Canadian
- Indian English

Later optional:

- Arabic-influenced English examiner

### Why Not Device/System TTS

Browser or device TTS is not suitable as the canonical examiner voice:

- inconsistent by OS/browser/device
- hard to keep accent and voice stable
- weak control over product quality
- parity between web and mobile becomes unreliable

## TTS Provider Decision

### Recommendation

Use OpenAI TTS as the official production engine.

Reasons:

- the backend already supports OpenAI TTS fallback in `SpeechService`
- repo defaults already point to `gpt-4o-mini-tts`
- it is materially cheaper than the current ElevenLabs hot-path usage
- it keeps one supported API surface for production synthesis

Keep ElevenLabs only as a temporary fallback during migration, then remove it from the main path if quality is acceptable.

### Cost Direction

This will not make speaking delivery literally free, but it can get very close to storage/CDN cost for the base examiner experience.

Recurring runtime cost after migration should mainly be:

- transcription
- evaluation
- adaptive follow-up text generation
- first-time synthesis of uncached follow-up audio

Most base examiner audio becomes a reusable asset generated once and reused across many tests.

## Core Architecture

### 1. Audio Asset Library

Create a reusable audio-asset system for speaking.

Asset types:

- fixed phrase
- bank question
- cue card reading
- transition
- dynamic follow-up

Each asset stores:

- asset id
- text
- normalized cache key
- provider
- voice profile id
- audio format
- duration
- Supabase storage path
- checksum/hash
- status
- created at / last used at

### 2. Session Package

When the learner starts a full simulation, backend creates one session package:

- selected examiner profile
- selected bank question ids
- ordered segment list
- ordered audio asset references for all known segments
- part-level timing rules
- silence detection policy
- follow-up slots
- recovery metadata

The client should be able to render the full session from this package without waiting on ad hoc prompt construction.

### 3. Buffered Adaptive Layer

Adaptive follow-ups stay live, but constrained.

Rules:

- Part 1 and Part 3 only
- at most one narrow follow-up before moving back to the planned sequence
- generate text and audio while the learner is answering
- cache the resulting follow-up asset for reuse if the same normalized prompt occurs again

### 4. Client Playback Queue

Both web and mobile should use the same conceptual runtime:

- playback queue
- current segment pointer
- current turn type
- current recording policy
- preload next segment audio
- deterministic part transitions

The client should not be constructing the speaking flow itself. It should only be executing the manifest.

## Timing Model

### Part 1

- fixed opening
- 4 to 5 examiner questions total
- one short adaptive follow-up when useful
- candidate auto-stop after roughly 7 seconds of silence once speech has started

### Part 2

- examiner intro and cue card reading
- 1 minute prep countdown
- examiner launch phrase
- learner long turn
- no silence auto-submit in the first version
- hard cutoff at configured time limit

### Part 3

- fixed intro
- 3 to 4 examiner questions total
- short adaptive follow-up allowed
- candidate auto-stop after roughly 7 seconds of silence once speech has started

## Resume And Recovery

The session package should allow precise resume:

- current segment id
- current playback state
- current part
- already-completed learner turns
- already-generated follow-up assets

Failure policy:

- one retry for TTS/playback failure
- one retry for transcription failure
- one retry for upload failure
- if retry fails again, end the test and require a new simulation

## Supabase Storage Model

Use Supabase Storage as the audio asset distribution layer.

Suggested buckets:

- `speaking-examiner-audio`
- `speaking-followup-audio`

Suggested path scheme:

- `fixed/{voiceProfile}/{phraseId}.mp3`
- `questions/{voiceProfile}/part1/{questionId}.mp3`
- `questions/{voiceProfile}/part2/{questionId}.mp3`
- `questions/{voiceProfile}/part3/{questionId}.mp3`
- `dynamic/{voiceProfile}/{hash}.mp3`

CDN-backed signed or public URLs should be chosen based on privacy requirements, but asset delivery should not depend on application-server proxying.

## Prebuild Pipeline

Add a batch pipeline for speaking audio similar to the existing listening generation workflow.

Pipeline stages:

1. export fixed phrases and question-bank prompts
2. normalize/cache-key text
3. synthesize missing assets
4. upload to Supabase Storage
5. register asset metadata in the database
6. emit manifests or statistics for coverage and missing items

This pipeline should run offline or in CI/admin jobs, not during learner sessions.

## Web And Mobile UX Implications

### Web

- test start shows `Preparing full simulation`
- once package is ready, the learner moves into a stable examiner-led runtime
- examiner playback should not block on per-prompt synthesis
- candidate recording should only unlock when the queued examiner segment is complete

### Mobile

- use the same package semantics as web
- preserve mobile-specific audio session handling
- preload the next 1 to 2 segments aggressively to reduce playback gaps

### Shared UX Outcome

The learner should feel that:

- the examiner is in control
- the test has a real cadence
- part transitions are intentional
- audio and recording states are predictable

## Migration Strategy

### Phase 1

Keep current runtime endpoints, but add session package generation and base audio asset lookup.

### Phase 2

Switch web and mobile to consume the package-first runtime.

### Phase 3

Move adaptive follow-ups into buffered generation and cache them.

### Phase 4

Remove ElevenLabs from the hot path and keep only OpenAI TTS for production speaking synthesis, unless quality review forces a fallback.

## Success Criteria

Functional:

- a new full test starts with a prepared session package
- all base examiner turns use prebuilt audio
- Part 1 auto-switches to Part 2
- Part 2 auto-switches to Part 3
- examiner profile stays fixed within a session

Experience:

- no visible “waiting for prompt audio” between known base prompts
- no manual `continue after prompt` clicks
- the learner perceives the test as one continuous examiner-led flow

Performance:

- full session package assembly under 60 seconds for a cold start
- warm-start package assembly substantially faster through existing assets
- next examiner segment already buffered before the learner finishes most turns

Operational:

- base audio cache hit rate is high enough that the majority of runs avoid live TTS for known segments
- adaptive follow-up cache hit rate increases over time

## Recommendation

Proceed with:

- OpenAI TTS as primary
- Supabase-hosted reusable audio assets
- one examiner profile per session
- prebuilt base test package
- buffered live follow-ups only where they add real value

This is the strongest path to a smoother, cheaper, and more believable speaking simulation on both web and mobile.
