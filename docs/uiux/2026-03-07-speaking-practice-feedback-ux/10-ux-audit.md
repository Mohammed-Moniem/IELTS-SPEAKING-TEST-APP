# UX Audit

## Rubric Coverage

- Accessibility (WCAG-aligned)
- Usability heuristics
- Custom context checks: perceived latency, task continuity, review discoverability, recovery confidence

## Findings by Severity

### P0

#### SPK-P0-01: Processing status is too subtle for a latency-sensitive action

- Evidence: the active session only shows a small chip in the upper-right corner for states like `uploading`, `idle`, or `error`, while the main body of the card remains visually unchanged
- Affected users/surfaces: speaking learners on web; highest risk on slower networks or longer uploads
- Impact summary: users cannot reliably tell whether audio is being uploaded, whether scoring is still in progress, or whether something has gone wrong
- Severity: `P0`
- Priority score: `20.0`
- Suggested direction: replace the small badge with an inline status block that includes a spinner/progress indicator, plain-language status text, expected wait framing, and visible failure recovery actions
- Success metric: reduced support/confusion reports about “did it submit?” and improved completion from `record_stop` to `result_viewed`
- Confidence note: high confidence from screenshot evidence and current component structure

#### SPK-P0-02: Result discovery depends on scrolling away from the user’s current focus area

- Evidence: after recording, `Transcription` and `Practice Result` render as separate cards below the active workspace
- Affected users/surfaces: all speaking practice learners on desktop and mobile
- Impact summary: the moment of payoff is hidden below the fold, so users can miss the outcome and assume feedback never arrived
- Severity: `P0`
- Priority score: `25.0`
- Suggested direction: present the first result state directly inside the active-session region or immediately beneath a sticky status transition that scrolls/focuses the learner to the review block
- Success metric: higher `result_viewed_in_viewport` rate and lower drop-off after upload
- Confidence note: high confidence; directly observed in the screenshot and current section ordering

### P1

#### SPK-P1-03: The session remains visually “active” even after a result exists

- Evidence: the page keeps the `Active Session` card on screen, then adds `Transcription` and `Practice Result` below it, which creates a mixed state rather than a clear transition
- Affected users/surfaces: speaking learners reviewing a completed recorded attempt
- Impact summary: users must infer whether they should keep recording, edit text, or review the score
- Severity: `P1`
- Priority score: `16.0`
- Suggested direction: once audio is processed successfully, morph the workspace into a `Review your response` state instead of leaving the recording layout visually dominant
- Success metric: faster time from upload completion to first meaningful review interaction
- Confidence note: high confidence from current layout structure

#### SPK-P1-04: The manual transcript area is presented as fallback but doubles as a review surface without clear mode change

- Evidence: the textarea remains in the main flow with the label `Fallback Manual Transcript`, even when a microphone capture/transcription succeeded
- Affected users/surfaces: all learners who record audio and then inspect the result
- Impact summary: mode confusion; users may not understand whether the text shown is editable fallback input, transcribed speech, or the submitted answer
- Severity: `P1`
- Priority score: `15.0`
- Suggested direction: relabel the textarea contextually. Use `Transcript preview` after successful speech processing and `Manual answer fallback` only when the user is in recovery mode
- Success metric: fewer mode-switch errors and stronger confidence in what was submitted
- Confidence note: medium-high confidence; observed from current naming and resulting layout

#### SPK-P1-05: Failure recovery is not anchored to the user’s immediate task

- Evidence: users get a tiny error state marker plus generic messaging, but the interface does not clearly switch into a `record failed, use manual fallback or retry` state
- Affected users/surfaces: learners encountering upload, transcription, or auth failures
- Impact summary: users do not know whether to retry recording, wait longer, or use manual fallback
- Severity: `P1`
- Priority score: `16.0`
- Suggested direction: define a dedicated failure state with explicit actions: `Retry upload`, `Use manual transcript`, `Discard and choose another topic`
- Success metric: improved recovery completion after `upload_failed`
- Confidence note: medium-high confidence based on screenshot and existing control layout

### P2

#### SPK-P2-06: Inline feedback is too shallow relative to reading/writing review expectations

- Evidence: the result card currently foregrounds the band score and a short summary, with improvements listed separately and full detail only discoverable elsewhere
- Affected users/surfaces: learners expecting a richer explanation comparable to other module feedback
- Impact summary: the first-result experience feels underpowered and may reduce trust in the score
- Severity: `P2`
- Priority score: `10.7`
- Suggested direction: enrich the inline summary with compact rubric rows, transcript snippet, top strengths, top 2 improvement actions, and a `See full report` CTA
- Success metric: higher engagement with review actions and improved perceived usefulness
- Confidence note: medium confidence; inferred from current content density and the user’s direct feedback

#### SPK-P2-07: System status language is too implementation-like and not learner-centered

- Evidence: labels such as `idle`, `error`, and `uploading` appear as internal states instead of action-oriented learner language
- Affected users/surfaces: all learners
- Impact summary: weak trust and low clarity
- Severity: `P2`
- Priority score: `9.0`
- Suggested direction: use user-facing copy such as `Ready to record`, `Uploading your answer`, `Reviewing your response`, `We couldn’t process that recording`
- Success metric: clearer comprehension in usability testing and support feedback
- Confidence note: high confidence

#### SPK-P2-08: Question, transcript, and result are not visually tied together as one answer package

- Evidence: the question stays in the session card, the transcript is separated into its own card, and the result sits below both
- Affected users/surfaces: learners trying to understand “what was judged”
- Impact summary: comparison requires memory and scrolling
- Severity: `P2`
- Priority score: `10.0`
- Suggested direction: bundle prompt, transcript, and score in one review layout with clear section dividers
- Success metric: improved comprehension in moderated review tasks
- Confidence note: high confidence

### P3

#### SPK-P3-09: The page lacks a clear “next best action” after a result is shown

- Evidence: once the score appears, there is no strong primary CTA for `View full report`, `Try another topic`, or `Practice weakest area`
- Affected users/surfaces: learners who finish a practice attempt
- Impact summary: users may stall or leave without taking the next productive step
- Severity: `P3`
- Priority score: `6.0`
- Suggested direction: add a dominant post-result CTA and two smaller follow-up actions
- Success metric: higher continuation from completed practice to another meaningful activity
- Confidence note: medium confidence

## Evidence and Confidence Notes

- Primary evidence: user screenshot of the current speaking recording/review state and current speaking page structure in `web-saas/app/(learner)/app/speaking/page.tsx`
- Secondary evidence: recent observed bugs around recording upload feedback and fallback affordance
- Confidence is highest for visibility, hierarchy, and recovery findings because they are directly visible in the current UI
- Confidence is medium for cross-module comparison expectations because no analytics or session recordings were provided in this pass
