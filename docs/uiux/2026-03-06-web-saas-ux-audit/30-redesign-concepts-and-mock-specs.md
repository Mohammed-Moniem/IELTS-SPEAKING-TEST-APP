# Redesign Concepts and Mock Specs

## Concept 1: Focus Mode Learner OS

### Intent

- Solve activation and return-visit hesitation by turning the learner app into a daily plan, not a feature catalog.

### Visual direction

- Keep the current premium violet system.
- Reduce simultaneous card weight.
- Make one daily action dominant, one recovery action secondary, and everything else tertiary.

### Interaction model

- Desktop: collapsible sidebar plus sticky "Today" rail
- Mobile: bottom nav with dashboard, practice, progress, billing, and more
- Module entry cards inherit the learner's current target band and weakest skill

### Key screens

- Learner dashboard
- Speaking module
- Progress hub
- Full exam resume state

### Tradeoffs

- Strengths:
  - Faster activation
  - Better repeat-use rhythm
  - Easier mobile adaptation
- Risks:
  - Requires stronger personalization logic
  - Some currently visible features move below the fold

### Expected outcome

- Higher first-click confidence and more practice sessions started per returning learner visit

## Concept 2: Proof-Led Conversion Funnel

### Intent

- Increase trust and plan selection confidence without changing the brand.

### Visual direction

- Keep the clean academic premium look.
- Add more proof blocks: score movement examples, testimonial quotes, methodology evidence, and "best for" plan framing.

### Interaction model

- Sticky CTA with mobile menu
- Pricing cards grouped by exam timeline, not only plan type
- Register page progressively reveals optional codes after core account creation

### Key screens

- Home
- Pricing
- Register

### Tradeoffs

- Strengths:
  - Better conversion clarity
  - Less plan paralysis
  - Stronger credibility for higher-price tiers
- Risks:
  - Needs real proof assets
  - Requires tighter copy governance

### Expected outcome

- Higher pricing-to-register conversion and better paid-plan mix

## Concept 3: Coaching Workspace Pattern

### Intent

- Make module pages feel like guided coaching sessions rather than tool consoles.

### Visual direction

- One workspace with three states:
  - setup
  - active session
  - feedback and next action
- Use persistent right-rail coaching on desktop and inline coach cards on mobile

### Interaction model

- Hide advanced or fallback controls until needed
- Show progress, time, and coaching prompts in one predictable place
- End every completed session with exactly one next step and one alternate path

### Key screens

- Speaking
- Writing
- Full exams
- Billing and settings as support surfaces

### Tradeoffs

- Strengths:
  - Lower cognitive load
  - Better continuity between modules
  - Cleaner transition from activity to feedback
- Risks:
  - Requires restructuring existing page flows
  - More state-design work

### Expected outcome

- Higher session completion and feedback-follow-through

## Mock Spec Index

- `mocks/marketing-home-hero.md`
- `mocks/learner-dashboard-focus-mode.md`
- `mocks/billing-settings-trust-center.md`
