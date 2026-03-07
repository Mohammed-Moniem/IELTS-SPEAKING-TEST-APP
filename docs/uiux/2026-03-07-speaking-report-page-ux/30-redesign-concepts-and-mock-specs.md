# Redesign Concepts and Mock Specs

## Concept 1: Coach Debrief Report

Intent:
- make the page feel like a premium post-practice coaching debrief, not a stored record

Visual direction:
- strong hero summary at the top
- one dominant score block with verdict and next action
- transcript and rubric moved below the verdict instead of competing with it
- a separate example-answer block that shows what a stronger response could sound like
- more editorial spacing and less card sprawl

Interaction model:
- above fold answers `How did I do?` and `What next?`
- deeper details expand below
- transcript section adapts to content length

Tradeoffs:
- strongest clarity and highest perceived value
- slightly less “analytical dashboard” feel

Expected outcome:
- best option for retention and value perception

Recommendation:
- recommended

## Concept 2: Adaptive Transcript + Insight Rail

Intent:
- keep the report analytical, but avoid the empty left-column problem

Visual direction:
- flexible transcript module on the left
- sticky insight rail on the right for band, summary, and actions
- transcript collapses when the answer is short

Interaction model:
- suited to medium and long transcripts
- right rail remains action-oriented while scrolling

Tradeoffs:
- useful for richer transcript analysis
- less emotionally strong than a debrief hero for short responses

Expected outcome:
- improves readability while preserving an “analysis” feel

## Concept 3: Report + Improvement Plan

Intent:
- combine feedback with an actionable next-practice prescription

Visual direction:
- top report summary
- middle diagnostic explanation
- bottom study prescription area with suggested drills, vocabulary, and retry CTA

Interaction model:
- report naturally ends with a personalized next step

Tradeoffs:
- highest retention upside
- more content design work and stronger dependency on recommendation logic

Expected outcome:
- best long-term learning flow, slightly higher implementation effort

## Mock-Screen Specifications

### Screen A: Above-Fold Report Hero

Screen purpose:
- orient the learner immediately and establish value

Content hierarchy:
1. Prompt title
2. Overall band and plain-language verdict
3. Session date and compact metadata
4. One-sentence `why this score happened`
5. Primary CTA: `Retry this prompt`
6. Secondary CTAs: `Practice weakest skill`, `Back to Speaking`

Primary actions:
- retry the same prompt

Secondary actions:
- open relevant library resources
- go back to speaking dashboard

States:
- loading: skeleton with hero layout, not a generic single loading card
- success: score + verdict + CTA visible above fold
- sparse-response state: hero explicitly notes that the short response limited the analysis
- failure: retry report + exit action

Accessibility notes:
- hero actions must remain keyboard reachable in logical order
- verdict and score should not rely on color alone

### Screen B: Why This Score Happened

Screen purpose:
- translate rubric numbers into learner language

Content hierarchy:
1. `Why this score happened`
2. 2-4 plain-language bullets
3. rubric tiles

Primary actions:
- none; informational bridge section

States:
- partial feedback: show only available categories with explicit note

Accessibility notes:
- bullets and rubric labels should be semantically grouped

### Screen C: Transcript + Coaching Evidence

Screen purpose:
- connect the actual answer to the feedback

Content hierarchy:
1. Transcript header
2. response text
3. optional coach callouts or flags

Primary actions:
- optional `Copy transcript`

Secondary actions:
- collapse/expand transcript for long answers

States:
- short transcript: compact height, no oversized container
- long transcript: expandable section

Accessibility notes:
- transcript block must preserve readable line length and strong contrast

### Screen D: Example Stronger Answer

Screen purpose:
- show the learner what a better response could sound like in practice

Content hierarchy:
1. `Example stronger answer`
2. short framing note explaining that this is a model, not the learner’s own response
3. improved sample answer
4. optional callouts showing what improved

Primary actions:
- optional `Retry with this structure`

Secondary actions:
- copy structure
- compare with transcript

States:
- if no generated example is available, show a structured answer outline instead

Accessibility notes:
- clearly distinguish the learner transcript from the example answer
- avoid color-only differentiation

### Screen E: Next Step Plan

Screen purpose:
- turn insight into action

Content hierarchy:
1. Primary recommendation
2. 2-3 suggested actions
3. optional related vocabulary/collocation links

Primary actions:
- retry prompt or start targeted practice

Secondary actions:
- review relevant library content
- open study plan

Accessibility notes:
- CTA labels should be explicit and outcome-based

## Optional Image Prompts

Recommended prompt:
- “Design a web SaaS speaking-report page for an IELTS preparation product. Keep the current Spokio brand feel with clean white surfaces and violet accents. Create a premium coaching debrief layout with a top summary hero showing overall band, a plain-language verdict, and one strong next action. Below that, show a ‘Why this score happened’ explanation, a compact transcript block that adapts to short answers, rubric metric tiles, strengths/improvements, and a next-step practice plan. Avoid empty dashboard-like whitespace, avoid generic analytics layouts, and avoid dark mode.”
