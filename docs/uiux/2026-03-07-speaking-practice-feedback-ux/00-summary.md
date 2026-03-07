# UI/UX Strategy Summary

- Date: 2026-03-07
- Topic: speaking-practice-feedback-ux
- Surfaces: web primary, mobile adaptation notes
- Severity model: `P0` critical blocker, `P1` major friction, `P2` moderate improvement, `P3` polish

## Scope

- Primary surface: learner web speaking practice flow after the user starts a practice topic and records audio
- Target journey: `record -> upload -> receive transcript/feedback -> decide whether to inspect full details`
- Primary actor: IELTS learner using the speaking practice tab on desktop web
- Business goal: reduce abandonment after recording and increase confidence that feedback is being generated
- Assumptions:
  - This request is focused on `web-saas`, not the mobile app
  - Speaking upload/transcription can take several seconds
  - The current history/details page remains available and should stay as a secondary drill-down
  - The screenshot and current speaking page structure are representative of the intended experience

## Success Criteria

- Users can clearly tell whether the system is `recording`, `uploading`, `processing`, `failed`, or `complete`
- The first useful feedback state appears above the fold without requiring a long scroll
- Transcript, score, and next actions are presented in one coherent review area
- The page prevents empty manual-submit actions and makes fallback behavior obvious
- A richer inline result summary is available before the user chooses to open a details page

## Key Risks

- Users stop waiting during upload because the page provides almost no prominent progress feedback
- Users miss the result because it renders below the active card and below the fold
- Users do not understand whether the session is still active, completed, or failed because the same workspace stays on screen with a tiny status chip
- Users cannot easily compare the original prompt, what was transcribed, and why the band score was assigned

## Executive Recommendations

- Replace the tiny top-right status pill with a full-width session-status block inside the active workspace. Use explicit copy such as `Uploading your answer`, `Transcribing speech`, `Scoring response`, and `Upload failed`.
- Collapse the current three-block experience into one stacked workspace: `prompt + recorder`, then `processing`, then `inline review summary`. Do not make the user scroll away from the task to discover the outcome.
- Promote the first feedback view into a richer inline review card with band score, short rubric breakdown, transcript preview, top strengths, top improvements, and a secondary `Open full report` action.
- Treat the details page as a drill-down. Show the essential review in-place first, then let the learner opt into the deeper report.
