# Priority Roadmap

## Immediate (0-2 weeks)

- Reframe the page as a report hero, not a metadata/detail view.
- Demote `Session ID` and move meaningful insight above the fold.
- Replace the rigid two-column first impression with:
  - summary hero
  - `Why this score happened`
  - adaptive transcript block
- Add an explicit `Your transcript` section plus an `Example stronger answer` or answer-outline section.
- Add one primary CTA and at least two secondary actions tied to improvement.
- Rewrite sparse states such as `No strengths captured.` into constructive coaching language.

## Next (2-6 weeks)

- Add transcript-aware coaching callouts or tagged evidence.
- Add retry and targeted-practice deep links based on weakest skill.
- Introduce session comparison hooks if prior speaking attempts exist.
- Improve mobile stacking so hero, verdict, and action remain visible without long scroll chains.

## Later (6+ weeks)

- Add progress-over-time framing across speaking reports.
- Personalize recommended next steps using study plan or weak-skill trends.
- Explore richer transcript annotations if backend evidence becomes available.

## Acceptance Criteria

- Above the fold on desktop shows:
  - prompt context
  - overall band
  - plain-language verdict
  - one primary next action
- The page no longer contains a large visually empty region when the transcript is short.
- The report explains the score before or alongside the rubric numbers.
- The learner can clearly distinguish between:
  - their own transcript
  - a model stronger answer or outline
- The page includes at least one direct improvement action beyond `Back to Speaking`.
- Empty or weak-result states still feel constructive and intentional.
- Mobile layout preserves the same hierarchy in a single-column flow.

## Verification Plan

- Qualitative:
  - run a five-second test and ask learners what score they got and what they should do next
  - verify that both answers are obvious without scrolling
- UX validation:
  - compare current page vs redesigned concept on perceived value and clarity
- Instrumentation:
  - track report view to next-practice CTR
  - track retry-prompt CTR
  - track library/study-plan CTA CTR from the report
- Accessibility:
  - verify heading order
  - verify keyboard access to primary/secondary CTAs
  - verify short and long transcript layouts remain legible
