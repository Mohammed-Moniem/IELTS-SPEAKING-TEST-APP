# UX Audit

## Rubric Coverage

- Accessibility (WCAG-aligned)
- Usability heuristics
- Custom context checks:
  - post-feedback value reinforcement
  - trust/credibility of AI scoring
  - next-action clarity for continued practice

## Findings by Severity

### P1

#### SR-01: The page fails the “full report” mental model

- Evidence:
  - the current page is mostly two generic cards with a score grid and a transcript box
  - the header foregrounds `Session ID` more than insight or learning outcome
  - the only high-intent action is `Back to Speaking`
- Affected users/surfaces:
  - all learners opening a speaking detail page after evaluation
- Impact summary:
  - reduces perceived depth and value of the report
  - makes the page feel like a technical record rather than a coaching artifact
- Severity: `P1`
- Priority score: `30` (`impact 5 * confidence 5 * risk 3 / effort 2`)
- Suggested direction:
  - lead with a coaching summary hero and outcome framing before transcript/rubric detail
- Success metric:
  - increased clicks on next-practice CTAs from the report page
- Confidence note:
  - high; strongly supported by the current visual hierarchy and screenshot

#### SR-02: The layout wastes space and looks broken for short answers

- Evidence:
  - the transcript card reserves a large empty column when the learner response is short
  - the right column carries most of the real value while the left column creates a visual dead zone
- Affected users/surfaces:
  - especially learners with short or weak answers, which is exactly when coaching clarity matters most
- Impact summary:
  - makes the page feel unfinished or low-value
  - visually punishes weaker users with more blank space
- Severity: `P1`
- Priority score: `40` (`impact 5 * confidence 5 * risk 4 / effort 2.5`)
- Suggested direction:
  - use an adaptive content layout that collapses transcript height and promotes insight blocks when transcript content is sparse
- Success metric:
  - no large blank content region remains above the first viewport fold on short-response reports
- Confidence note:
  - high

#### SR-03: The page does not tell the learner what to do next

- Evidence:
  - there is no direct `Retry`, `Practice weakest skill`, `Review vocabulary`, or `Study plan` action
  - strengths and improvements are displayed, but not operationalized into a next step
- Affected users/surfaces:
  - learners trying to improve after a disappointing result
- Impact summary:
  - weakens retention and practice continuation
  - turns feedback into passive reading instead of guided action
- Severity: `P1`
- Priority score: `24` (`impact 4 * confidence 4 * risk 3 / effort 2`)
- Suggested direction:
  - add a strong action zone with one primary recommendation and 2-3 secondary actions
- Success metric:
  - report-to-practice CTR improves
- Confidence note:
  - high

### P2

#### SR-04: Raw rubric numbers are present, but explanation is thin

- Evidence:
  - band tiles exist, but the learner has to infer why each number matters
  - the summary is visually secondary and detached from the rubric grid
- Affected users/surfaces:
  - all report viewers, especially non-expert IELTS learners
- Impact summary:
  - the page explains “what” more than “why”
- Severity: `P2`
- Priority score: `16`
- Suggested direction:
  - add a `Why this score happened` block that translates rubric findings into plain language
- Success metric:
  - more learners interact with follow-up actions without needing a second explanation surface
- Confidence note:
  - high

#### SR-05: Transcript and score are not visually connected

- Evidence:
  - transcript sits in one card, rubric sits in another, with no explicit bridge between them
  - nothing points from the learner’s response to the resulting feedback
- Affected users/surfaces:
  - all report viewers
- Impact summary:
  - makes the feedback feel generic rather than grounded in the actual answer
- Severity: `P2`
- Priority score: `13.3`
- Suggested direction:
  - connect transcript to analysis through a coach summary or highlighted coaching cues
- Success metric:
  - improved qualitative comprehension in usability review
- Confidence note:
  - medium-high

#### SR-05b: The page does not show a better-answer example

- Evidence:
  - the current report stops at score, summary, strengths, and improvements
  - there is no model answer, improved rewrite, or “what good looks like” example
- Affected users/surfaces:
  - all report viewers, especially learners who do not know how to turn abstract advice into a better spoken response
- Impact summary:
  - feedback remains conceptual instead of teachable
  - the learner knows what was weak, but not what a stronger answer would sound like
- Severity: `P2`
- Priority score: `16`
- Suggested direction:
  - add an `Example stronger answer` section or a short coached rewrite that demonstrates a higher-quality response without pretending it is the learner’s own answer
- Success metric:
  - increased clicks on retry/practice CTAs after reading the report
- Confidence note:
  - high

#### SR-06: Empty strengths state feels discouraging and low-signal

- Evidence:
  - `No strengths captured.` reads like missing analysis rather than a constructive coaching statement
- Affected users/surfaces:
  - weaker learners and low-scoring reports
- Impact summary:
  - reduces trust and motivation
- Severity: `P2`
- Priority score: `12`
- Suggested direction:
  - rewrite empty states into constructive coaching language such as “Start here” or “First strength to build”
- Success metric:
  - fewer negative qualitative reactions in session review
- Confidence note:
  - medium-high

### P3

#### SR-07: Metadata hierarchy is backward

- Evidence:
  - `Session ID` occupies prominent header real estate while the meaningful context is below
- Affected users/surfaces:
  - all report viewers
- Impact summary:
  - technical metadata is louder than learning insight
- Severity: `P3`
- Priority score: `6`
- Suggested direction:
  - demote session ID to secondary metadata under the hero or behind a details row
- Success metric:
  - cleaner above-fold hierarchy
- Confidence note:
  - high

## Evidence and Confidence Notes

Evidence sources:
- supplied screenshot of the current report page
- current route implementation in [page.tsx](/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx)
- surrounding speaking flow behavior in [page.tsx](/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/app/(learner)/app/speaking/page.tsx)

Assumptions:
- this page is meant to be a premium-feeling detail view after the new inline review experience
- learners use it as a deeper follow-up, not as the first place they ever see feedback

Confidence summary:
- high on layout/hierarchy findings
- medium on exact engagement lift until analytics are instrumented
