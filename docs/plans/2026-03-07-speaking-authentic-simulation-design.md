# Speaking Authentic Simulation Design

## Goal

Restore the full IELTS speaking simulation as an examiner-led voice experience on both web and mobile, replacing the current form-like simulation flow with a guided session that feels like a real test.

## Product Outcome

The learner should experience one continuous speaking test:

1. The examiner greets them and asks the fixed opening questions.
2. The examiner delivers Part 1 questions one at a time, with adaptive follow-ups.
3. The examiner introduces Part 2, gives prep time, starts the long turn, and closes it at the time limit.
4. The examiner runs Part 3 as a discussion with adaptive follow-ups.
5. The learner speaks only during dedicated answer turns.
6. The system evaluates the complete session after the final examiner close.

## Problem

The current web full simulation is a textarea-driven workflow with manual navigation between parts. It trains topic coverage, but it does not train the live speaking experience that differentiates the product. The older mobile implementation already proved the right direction: staged examiner speech, timed transitions, microphone-led learner turns, and realistic pacing. That experience regressed into a simpler form flow and now needs to be restored and unified.

## Recommended Approach

Use a shared `examiner-led runtime` across web and mobile.

- Keep the repeated examiner lines fixed and cached.
- Generate dynamic examiner question audio through the existing speech stack.
- Use adaptive examiner follow-ups for Part 1 and Part 3 based on the learner's prior answer.
- Remove manual response textareas from the full simulation flow.
- Apply a guarded hard-pause model for failures: retry the same step once, then require a new test.

This is the best balance of authenticity, reuse, operational cost, and control.

## Alternatives Considered

### 1. Fully scripted simulator

Pre-generate every examiner question and follow a fixed sequence.

Why not:
- too predictable
- weaker competitive advantage
- less exam-like for learners who need conversational pressure

### 2. Fully live conversational examiner

Generate every line dynamically, including the opening and all transitions.

Why not:
- highest latency and cost
- hardest to keep IELTS-consistent
- highest failure surface for a premium learner flow

## Experience Principles

- `Examiner-first`: the examiner controls the pace and transitions.
- `Voice-only`: no manual fallback UI during the full simulation.
- `Step clarity`: at any moment the learner should know whether the examiner is speaking, the learner should speak, the system is processing, or the test is paused.
- `IELTS fidelity`: wording, timing, and transitions should match the actual test as closely as practical.
- `Cross-platform parity`: web and mobile should share the same runtime semantics and examiner script behavior.

## Runtime Model

The full simulation should move from a loose part payload to a structured session runtime.

### Shared state machine

- `preflight`
- `intro-examiner`
- `intro-candidate-turn`
- `part1-examiner`
- `part1-candidate-turn`
- `part1-processing`
- `part1-transition`
- `part2-intro`
- `part2-prep`
- `part2-examiner-launch`
- `part2-candidate-turn`
- `part2-cutoff`
- `part2-transition`
- `part3-intro`
- `part3-examiner`
- `part3-candidate-turn`
- `part3-processing`
- `evaluation`
- `completed`
- `paused-retryable`
- `failed-terminal`

### Session data the runtime must own

- selected Part 1, Part 2, and Part 3 seed prompts
- current part and current turn
- conversation history for adaptive follow-ups
- cached phrase ids already used
- dynamic examiner utterance text for each turn
- learner recording/transcript metadata per turn
- retry count per step
- final aggregated evaluation payload

## Audio Strategy

### Fixed repeated lines

The following should come from one shared phrase catalog used by both clients:

- greeting
- name request
- passport / identification request
- Part 1 opening
- Part 1 close
- Part 2 opening instructions
- Part 2 “please begin speaking now”
- Part 2 close
- Part 3 opening
- full-test close

These lines should be cached aggressively because they repeat across every test and should remain consistent.

### Dynamic examiner prompts

Question prompts, adaptive follow-ups, and some transitions should use the existing backend synthesis path:

- existing `speech/synthesize`
- existing mobile cache strategy as the reference model
- same voice profile on web and mobile

The learner should never see raw prompt text as the primary interface during the live run. Text can appear as a secondary support aid if needed, but the main interaction is audio-led.

## Adaptive Follow-ups

### Part 1

Use the current conversational examiner capability to ask short follow-ups based on the learner’s answer. Keep the examiner concise and IELTS-like. The runtime should cap the number of Part 1 turns so the section does not sprawl.

### Part 2

Do not make the long turn conversational. The examiner introduces the cue card, the learner prepares, the learner speaks for the timed turn, and the examiner closes the part. This preserves IELTS fidelity.

### Part 3

Use the conversational examiner capability again, but with broader and more analytical prompts. Follow-ups should respond to what the learner said, while still respecting a maximum turn count or section duration.

## Web UX

The web learner app should replace the current form simulation with a dedicated full-test stage inside the speaking page.

### Required surfaces

- `preflight card`
  - mic readiness
  - audio output readiness
  - `Begin full simulation`

- `live examiner stage`
  - large status header: `Examiner speaking`, `Your turn`, `Processing answer`, `Paused`
  - examiner subtitle/transcript strip for accessibility
  - single mic-led answer state
  - part progress and elapsed time

- `hard-pause recovery panel`
  - clear explanation of what failed
  - `Retry step`
  - `End test`

- `final evaluation transition`
  - visible “Evaluating your full speaking test...”

The learner should not be able to jump between parts, manually edit answers, or submit freeform text during the simulation.

## Mobile UX

The mobile learner app should restore the old staged experience rather than maintaining a separate form-like interaction model.

### Required behavior

- examiner audio plays through the same voice service and phrase cache
- learner turn is explicitly gated by mic state
- part transitions are spoken and visually obvious
- prep timer for Part 2 is prominent
- adaptive follow-ups feel conversational, not like tapping through cards

Mobile and web should differ in layout only, not in session logic.

## Backend Changes

The backend needs to stop treating full simulation as a single “three-part form submission” and instead support a session runtime.

### Needed capabilities

- start a simulation runtime session
- advance the runtime through fixed examiner segments
- accept a learner audio turn
- transcribe the turn
- generate the next adaptive examiner turn when applicable
- decide whether to continue the current part or transition to the next one
- complete and evaluate the entire session at the end

### Existing backend pieces to reuse

- `TestSimulationService` for session ownership and history
- `QuestionGenerationService` for seed prompts
- `speech/transcribe`
- `speech/synthesize`
- `speech/examiner/chat`
- full-test evaluation in `SpeechService`

## Failure Handling

Use a guarded hard-pause model.

### Rules

- If TTS fails, pause the test before the learner turn begins.
- If mic capture fails, pause the current learner turn.
- If transcription fails, pause after recording ends.
- Allow exactly one retry of the failed step.
- If the retry fails again, terminate the session and require a new simulation.

### Why this model

- preserves the authenticity of the product
- avoids the current manual textarea escape hatch from diluting the premium experience
- still gives the learner one recovery attempt before losing the run

## Evaluation and Reports

The final report remains part of the experience, but it should be fed from the new runtime structure.

### Required evaluation inputs

- per-turn transcript
- per-turn durations
- part grouping
- final combined transcript
- metadata about follow-up coverage and interruptions

### Report direction

- keep the improved report page
- add clear separation of Part 1, Part 2, and Part 3 contributions
- preserve transcript visibility and stronger-answer guidance

## Testing Strategy

### Backend

- unit tests for runtime transitions
- unit tests for retry / hard-pause logic
- unit tests for adaptive follow-up branching
- controller tests for start, answer, retry, complete

### Web

- Playwright coverage for:
  - preflight
  - examiner audio / learner turn lock
  - Part 1 adaptive follow-up path
  - Part 2 prep and timed speaking
  - Part 3 adaptive discussion
  - paused retry flow
  - final evaluation

### Mobile

- Jest / React Native Testing Library coverage for the restored stage transitions
- service-level tests for phrase caching and runtime state changes
- manual smoke on a real device for mic + audio + interruption behavior

## Acceptance Criteria

- Web and mobile both run the same examiner-led full simulation structure.
- The learner cannot type or paste answers during the full simulation flow.
- Repeated examiner lines are cached and reused.
- Part 1 and Part 3 use adaptive examiner follow-ups.
- Part 2 behaves like a proper cue-card long turn with timed prep and timed speaking.
- Failures pause the test, allow one retry, and otherwise end the attempt.
- The final report evaluates the full session, not isolated part textareas.

## Recommendation

Build the backend runtime contract first, then restore the web simulation UI against it, then switch mobile to the same contract. This creates one product behavior instead of two drifting implementations.
