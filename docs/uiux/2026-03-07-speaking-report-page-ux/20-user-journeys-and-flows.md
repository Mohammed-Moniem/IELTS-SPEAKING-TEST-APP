# User Journeys and Flows

## Primary Journey

Actor:
- learner who has just completed speaking feedback and clicks `Open full report`

Goal:
- understand score in more detail and decide the next improvement step

Happy path:
1. Learner lands on the full report from inline review.
2. Above the fold, the page shows:
   - overall band
   - plain-language verdict
   - one primary recommendation
   - one primary CTA
3. Learner scans `Why this score happened`.
4. Learner checks transcript and rubric detail only if needed.
5. Learner chooses a next action such as retrying the prompt or practicing the weakest skill.

Key friction in the current version:
- the report opens as a sparse record, not a guided debrief
- there is no obvious “best next step”

Instrumentation hooks:
- `speaking_report_viewed`
- `speaking_report_primary_cta_clicked`
- `speaking_report_secondary_cta_clicked`
- `speaking_report_transcript_expanded`
- `speaking_report_retry_prompt_clicked`

## Secondary Journey

Actor:
- learner revisiting an old report from history

Goal:
- compare prior performance and resume study

Desired path:
1. Learner opens an older report.
2. Hero clarifies the session date and prompt context.
3. Page highlights the dominant weakness and recommends the most relevant practice route.
4. Learner exits directly into a new practice action, not just back to the generic speaking list.

## Failure and Recovery Paths

Failure cases:
- invalid or expired session id
- network failure while loading detail
- report has partial feedback only

Desired recovery:
- show a compact error state with `Retry report` and `Back to Speaking`
- if feedback is partial, still render a report shell with available transcript and a clear “analysis incomplete” note
- preserve next steps even when some diagnostics are unavailable

## Diagram Index

- [primary-user-flow.mmd](/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/docs/uiux/2026-03-07-speaking-report-page-ux/diagrams/primary-user-flow.mmd)
- [failure-recovery-flow.mmd](/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/docs/uiux/2026-03-07-speaking-report-page-ux/diagrams/failure-recovery-flow.mmd)
