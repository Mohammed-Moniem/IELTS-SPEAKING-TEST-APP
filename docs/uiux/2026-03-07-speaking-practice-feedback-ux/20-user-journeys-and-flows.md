# User Journeys and Flows

## Primary Journey

### Actor

- IELTS learner practicing a speaking prompt on desktop web

### Goal and trigger

- Goal: record one answer, understand that it is being processed, then review enough feedback to decide the next action
- Trigger: learner clicks `Start Practice` from a topic card

### Current happy-path friction

- The user records audio, but the system’s processing state is visually underpowered
- The reward moment is split into multiple lower blocks, so the learner can miss the result
- The learner must mentally stitch together prompt, transcript, and score

### Proposed happy path

1. User starts a topic and sees one focused session workspace
2. User records and stops upload
3. Workspace swaps into a prominent processing state with step-based feedback
4. Same workspace transitions into a `Review your response` summary
5. User chooses either `Open full report`, `Practice another topic`, or `Work on weakest skill`

## Secondary Journey

### Manual fallback journey

1. User starts a topic but recording fails or is unavailable
2. Workspace enters a visible recovery state with a manual-answer prompt
3. User types a fallback response
4. System submits and returns the same inline review summary pattern

### Returning learner journey

1. User revisits speaking with a saved in-progress attempt
2. Page restores the session and focuses the active workspace
3. User either resumes recording or switches to manual fallback
4. Result appears inline without forcing a long scroll

## Failure and Recovery Paths

### Upload/transcription failure

- System should stop presenting a passive `error` chip
- The workspace should surface a visible recovery panel:
  - what happened
  - whether the recording was saved
  - `Retry upload`
  - `Use manual transcript`
  - `Cancel attempt`

### Score-generation delay

- If transcription succeeds but evaluation is still running, keep the user inside one unified processing state
- Show progress language that matches the user’s mental model:
  - `Uploading recording`
  - `Transcribing speech`
  - `Generating feedback`

### Session/auth issue

- If token refresh or session validation fails during upload, do not silently collapse into a generic error state
- Preserve the typed/manual content and return the user to a safe recovery path

## Diagram Index

- diagrams/primary-user-flow.mmd
- diagrams/failure-recovery-flow.mmd
