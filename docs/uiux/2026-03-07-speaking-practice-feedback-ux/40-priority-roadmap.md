# Priority Roadmap

## Immediate (0-2 weeks)

- Replace the current tiny recorder state chip with a full-width status panel inside the active workspace
- Merge `Transcription` and `Practice Result` into a single inline review area that appears directly after processing
- Auto-scroll and focus the learner on the processing or review state when it changes
- Keep `Submit Manual Transcript` disabled until there is valid text in the field
- Add an explicit failure panel with `Retry upload`, `Use manual transcript`, and `Cancel attempt`

## Next (2-6 weeks)

- Add compact inline rubric detail so the first feedback view feels comparable to other modules
- Add `Open full report` as a secondary drill-down from the inline summary
- Instrument the speaking flow with events for start, stop, upload start, upload success, upload failure, result viewed, full report opened
- Tune desktop and mobile layout variants so the review summary stays above the fold as often as possible

## Later (6+ weeks)

- Explore a sticky review rail or result takeover pattern if inline summary adoption is still weak
- Add smarter next-action recommendations such as `practice a similar prompt` or `review collocations for weakest rubric area`
- Consider multi-step progress timing estimates if backend processing times remain variable

## Acceptance Criteria

- A learner can identify the system state within one second of glancing at the active workspace
- After upload, the first meaningful result content appears in the current viewport without requiring a long scroll
- Prompt, transcript, and feedback are visually grouped as one answer review experience
- Failure states provide at least two obvious recovery options
- The full report remains accessible but is no longer the first place a learner must go to understand the result

## Verification Plan

- Run a moderated usability check with 5 learners on the speaking practice flow
- Measure:
  - `record_stop -> upload_complete`
  - `upload_complete -> result_visible`
  - `upload_failed -> recovery_action_clicked`
  - `result_visible -> full_report_opened`
- Validate keyboard/focus flow and screen-reader announcements for status changes
- Confirm desktop and mobile screenshots show status and result above the fold in the most common viewport sizes
