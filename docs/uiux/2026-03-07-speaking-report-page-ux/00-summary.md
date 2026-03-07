# UI/UX Strategy Summary

- Date: 2026-03-07
- Topic: speaking-report-page-ux
- Surfaces: web primary, mobile secondary

## Scope

Focused audit of the speaking full-report detail page at `/app/speaking/history/[sessionId]`, using the current production structure in [page.tsx](/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/app/(learner)/app/speaking/history/[sessionId]/page.tsx) and the supplied screenshot as primary evidence.

Primary user:
- learner opening a speaking report right after receiving feedback

Business goal:
- reinforce value after AI scoring
- increase continued practice instead of a dead-end “view only” experience

Non-goals:
- changing scoring logic
- redesigning the whole speaking module
- replacing the dedicated detail page with inline-only feedback

## Success Criteria

- A learner can understand the result in under 10 seconds without scrolling.
- The page feels like a real “full report,” not a sparse detail view.
- The layout adapts gracefully to very short responses and avoids large empty dead zones.
- The page clearly answers three questions:
  - How did I do?
  - Why did I get this score?
  - What should I do next?
- There is at least one strong next-step action beyond `Back to Speaking`.

## Key Risks

- Overcorrecting into a dense analytics page would hurt scanability.
- Showing too many rubric components above the fold could bury the main insight.
- Short transcripts will always create content imbalance unless the layout adapts to response length.

## Executive Recommendations

Recommended direction: `Coach Debrief Report`.

Core changes:
- Replace the current split `Transcript` / `Band insights` shell with a report-first hero that leads with band, verdict, timestamp, and next action.
- Turn the page into a guided debrief:
  - summary verdict
  - top strengths
  - top improvements
  - targeted next practice CTA
- Make the transcript panel adaptive instead of reserving a large static block when the answer is short.
- Make the learner transcript unmistakable by labeling it as `Your transcript` and placing it in the main report flow, not as a quiet side card.
- Add an `Example stronger answer` or `What a better answer could sound like` section so the learner can compare their response with a concrete improvement model.
- Add a `Why this score happened` section above or beside the rubric tiles so the page reads as an explanation, not just raw scores.
- Add strong onward actions such as `Retry this prompt`, `Practice weakest skill`, and `Review collocations/vocabulary`.

Recommendation summary:
- Best concept: `Coach Debrief Report`
- Expected impact: higher perceived value, clearer learning takeaway, stronger return-to-practice behavior
- Confidence: high for hierarchy/layout issues, medium for downstream engagement lift without analytics
