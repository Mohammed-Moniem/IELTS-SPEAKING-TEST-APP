# Priority Roadmap

## Immediate

Time horizon: 0-2 weeks

### Work

1. Make marketing and learner navigation responsive.
2. Fix auth labeling and segmented-tab contrast.
3. Remove internal implementation language from learner-facing pages.
4. Rewrite passive empty states into action-oriented coaching states.

### Acceptance criteria

- Critical learner routes work at mobile and desktop widths.
- `npm run test:a11y` passes on login and speaking.
- No learner-facing copy contains `test-mode`, `UI only`, `unsupported`, or similar internal phrasing by default.
- Empty states always include a next action when a learner can do something meaningful.

### Verification

- Responsive QA at `320`, `375`, `768`, `1024`, and `1440` widths
- Playwright keyboard pass on login and register
- Axe pass on login, speaking, and dashboard
- Manual copy sweep on learner surfaces

## Next

Time horizon: 2-6 weeks

### Work

1. Redesign dashboard around one daily action, one resume path, and one weakest-skill recommendation.
2. Rework module pages into setup, active, and feedback states.
3. Strengthen pricing and home page proof architecture.
4. Simplify registration by moving optional codes behind a progressive disclosure step.

### Acceptance criteria

- Dashboard shows a single dominant primary CTA above the fold.
- Each module ends with a clear next step and a recovery option.
- Pricing has one recommended default path by exam timeline.
- Register form completion improves without reducing code capture rate materially.

### Verification

- Funnel analytics for home -> pricing -> register -> first session
- Session recordings for dashboard first click
- Usability check with at least 5 realistic first-time-user runs

## Later

Time horizon: 6-10 weeks

### Work

1. Add personalization based on exam date, target band, and weakest criterion.
2. Convert billing and settings into trust-support surfaces with contextual education.
3. Bring the same navigation and hierarchy model into admin for consistency.

### Acceptance criteria

- Learners see tailored plans and upgrade rationale based on their state.
- Billing and settings feel supportive, not diagnostic.
- Cross-surface navigation patterns become predictable.

### Verification

- Activation and retention deltas by cohort
- Billing self-serve completion rate
- Reduction in support requests tied to plan confusion or settings confusion

## Recommended KPI Set

- Home CTA click-through rate
- Pricing plan-selection rate
- Registration completion rate
- First-session start rate
- First-session completion rate
- Returning-learner first click to session start time
- Paid conversion rate from free
- Serious accessibility issue count on critical routes
