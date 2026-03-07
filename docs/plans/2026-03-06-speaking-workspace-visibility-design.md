# Speaking Workspace Visibility Design

## Goal

Make speaking actions feel immediate and obvious by ensuring the active workspace or result appears in view as soon as the learner starts practice, starts a simulation, or runs a quick evaluation.

## Problem

On the speaking page, clicking `Start Practice` launches a working session below the topic grid. The action succeeds, but the workspace appears far below the fold, so learners can miss that anything changed. The same visibility problem can affect simulation start and quick-evaluation results.

## Recommended Approach

1. Move the active practice session panel above the topic grid.
2. Add a shared scroll-and-focus pattern for the active workspace/result blocks.
3. Apply that pattern to:
   - practice session start
   - simulation start
   - quick evaluation result

## Why This Approach

- It improves layout hierarchy, not just scroll behavior.
- It keeps the topic grid available underneath the active session.
- It provides immediate confirmation for all three speaking flows with one consistent UX pattern.

## Implementation Notes

- Add refs for practice session, simulation session, and quick evaluation result blocks.
- Use a focused `scrollIntoView({ block: 'start', behavior: 'smooth' })` after the relevant state appears.
- Give each surfaced block a temporary `tabIndex={-1}` so focus can move there without changing semantics.
- Keep the current tab structure and data flow intact.

## Testing

- Add a Playwright regression to confirm:
  - starting practice brings `Active Session` into the viewport
  - starting simulation brings `Simulation in Progress` into the viewport
  - evaluating a quick transcript brings `Evaluation` into the viewport
- Run the targeted speaking spec and `npm run typecheck`.
