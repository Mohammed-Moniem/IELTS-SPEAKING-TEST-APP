# Redesign Concepts and Mock Specs

## Concept 1

### Name

- Guided Inline Review

### Intent

- Keep the learner in one visible workspace from recording through result review
- Best fit for users who need clear status feedback and immediate confidence that the system is working

### Visual direction

- One dominant session card with large internal state changes instead of multiple disconnected cards
- Strong status block beneath the question area
- Review summary appears in the same card after processing
- Brand fit: preserves Spokio’s soft violet accents and clean card language, but uses clearer hierarchy and stronger status emphasis

### Interaction model

- Recording state: recorder controls and tips
- Processing state: step progress panel with spinner, elapsed time, and reassurance copy
- Review state: band score, short rubric breakdown, transcript preview, top strengths, top improvements, `Open full report`

### Tradeoffs

- Strengths: lowest cognitive overhead, best continuity, easiest to understand
- Risks: requires careful state design so the card does not feel too tall
- Expected outcome: highest improvement in perceived responsiveness and result discoverability

### Recommendation

- Recommended concept for the first implementation pass

## Concept 2

### Name

- Session + Sticky Review Rail

### Intent

- Let the learner keep the prompt workspace visible while a right-side rail presents processing and result content

### Visual direction

- Desktop two-column layout: active session left, status/review rail right
- Mobile collapses to stacked sections with sticky status banner

### Interaction model

- While uploading, the right rail shows progress and expected wait copy
- On completion, the rail turns into the review summary without moving the user away from controls

### Tradeoffs

- Strengths: keeps the result visible without hiding the original task
- Risks: more layout complexity and weaker mobile parity
- Expected outcome: strong desktop comprehension, moderate implementation effort

## Concept 3 (optional)

### Name

- Result Takeover Panel

### Intent

- Treat successful submission as a major moment and replace the workspace with a result-first screen

### Visual direction

- Animated transition from recorder to a result sheet or full-page review panel
- Strong emphasis on band score and next steps

### Interaction model

- After upload, user is immediately moved to a focused result state
- `Back to workspace` and `Open full report` remain available

### Tradeoffs

- Strengths: very clear payoff moment
- Risks: can feel disruptive if learners want to stay anchored to the original prompt
- Expected outcome: highest emotional clarity, but riskier for continuity

## Mock-Screen Specifications

### Screen A: Recording workspace

- Purpose: start, monitor, and stop the speaking response
- Content hierarchy:
  - prompt
  - speaking tips
  - prominent recorder controls
  - clear fallback explanation
  - visible status area reserved below controls
- Primary actions:
  - `Start recording`
  - `Stop and upload`
- Secondary actions:
  - change microphone
  - switch to manual response
- Validation/error states:
  - microphone denied
  - no device
  - upload failed
- Accessibility notes:
  - status area should use `aria-live="polite"`
  - processing and failure messages should be screen-reader announced
  - disabled buttons must have clear visual contrast and not rely on opacity alone

### Screen B: Processing state

- Purpose: reassure the learner that the system is working and prevent premature abandonment
- Content hierarchy:
  - status title: `Reviewing your answer`
  - three-step progress list: upload, transcribe, evaluate
  - elapsed time and expected wait hint
  - recovery link if processing exceeds threshold
- Primary actions:
  - none while active, unless failure occurs
- Secondary actions:
  - `Use manual answer instead` after timeout threshold
- Success and failure states:
  - transitions directly into inline review on success
  - converts into explicit recovery panel on failure

### Screen C: Inline review summary

- Purpose: deliver enough value immediately without forcing a page change
- Content hierarchy:
  - band score
  - one-sentence verdict
  - compact rubric chips or rows
  - transcript preview
  - top strengths
  - top improvements
  - next action CTA cluster
- Primary actions:
  - `Open full report`
- Secondary actions:
  - `Practice another topic`
  - `Focus on weakest area`
- Accessibility notes:
  - result card should receive focus and scroll on reveal
  - transcript text must remain selectable and legible on mobile and desktop

## Optional Image Prompts

- Create a desktop web speaking practice screen for the Spokio IELTS learner app. Keep the current violet-on-light brand feel. Show one large card that transitions from recording to processing to inline feedback. Include a visible progress block for `Uploading`, `Transcribing`, and `Scoring`, then an inline result summary with band score, transcript preview, strengths, improvements, and an `Open full report` CTA. Avoid dark mode, avoid unrelated branding, avoid generic dashboard clutter.
