# Learner Dashboard Focus Design

**Date:** 2026-03-06

**Goal:** Rework the learner dashboard so the first screen answers one question clearly: what should this learner do next?

## Problem

The current dashboard looks polished, but it splits attention across several equal-weight surfaces:

- a header CTA for `Start New Test`
- a featured quick-practice card
- a resume card in the rail
- a recommended-topics block
- KPI cards above the action area

That makes the learner choose between several plausible next steps. The hierarchy is visually strong but behaviorally weak.

## UX Outcome

The redesigned dashboard should establish:

1. One dominant next action
2. One obvious resume path when an active session exists
3. One explicit weakest-skill recommendation grounded in learner data

## Chosen Approach

Use the existing dashboard payload for KPI, resume, activity, and topic prompts, and add a parallel `progress-view` fetch on the dashboard to compute the weakest skill from real `skillBreakdown` data.

This keeps the rewrite frontend-scoped while making the dashboard guidance honest and data-backed.

## Data Sources

### `dashboard-view`

Keeps responsibility for:

- KPI summary
- active resume session
- quick-practice entries
- recommended topic prompts
- recent activity

### `progress-view`

Adds responsibility for:

- current module breakdown
- weakest-skill ordering
- gap-to-target calculation used for focus recommendations

## Layout

### 1. Header

The page header remains, but it should stop competing with the action hero.

- Keep a lightweight welcome title
- Shift the subtitle toward clarity, not hype
- Remove the top-right primary CTA button

### 2. Primary Action Hero

This becomes the top-most and visually dominant surface.

#### If `resume` exists

Hero content:

- label: active session
- title: resume session title
- supporting line: subtitle plus progress
- one primary CTA: `Resume now`

This makes the in-progress path the default action.

#### If `resume` is `null`

Hero content:

- label: next best step
- title: weakest skill label
- supporting line: current band, target band, and short explanation
- one primary CTA into that module

This makes the weakest skill the default action for learners without an active session.

### 3. Secondary Focus Grid

Place two compact cards directly under the hero.

#### Weakest Skill Focus

Always show a focused recommendation card driven by `progress-view`.

Content:

- weakest skill name and icon
- current band and target gap
- one short reason
- one or two actions only

#### Supporting Practice Card

Show one supporting card depending on data availability:

- if `resume` exists: use this slot for `Suggested speaking prompts`
- if `resume` is `null`: use this slot for `Other ways to practice`

This avoids showing three or four competing module cards in the first viewport.

### 4. KPI Row

Keep metrics, but move them below the action area. Metrics should support learner confidence after the decision is clear, not compete with the decision itself.

### 5. Recent Activity

Keep the recent activity table lower on the page. Its purpose remains retrospective, not navigational.

## Content Rules

- Only one filled primary button above the fold
- Resume beats weakest-skill CTA whenever both exist
- “Recommended” must be renamed to match the actual data
  - if showing topic prompts, use a label like `Suggested speaking prompts`
- Quick-practice cards should be demoted from hero treatment
- Copy should explain why a module is recommended, not just present options

## Empty And Partial States

### New learner

If there is no resume and little/no activity:

- show a simple hero with a starter action
- still show weakest-skill guidance if `progress-view` is available
- otherwise fall back to a generic starter recommendation, preferably speaking

### `progress-view` failure

If progress data fails but dashboard data succeeds:

- keep the dashboard usable
- hero should prefer resume if present
- otherwise fall back to the first quick-practice item
- suppress weakest-skill framing that cannot be supported honestly

### Full dashboard failure

Existing error treatment can remain.

## Testing Implications

The redesign needs coverage for:

- resume-first hero behavior
- weakest-skill-first hero behavior when `resume` is `null`
- graceful fallback when `progress-view` fails
- stable rendering of topic prompt and activity sections after the layout shift

## Non-Goals

- No backend API contract changes in this pass
- No new recommendation engine beyond sorting current `skillBreakdown`
- No dashboard personalization beyond next-step hierarchy and copy
