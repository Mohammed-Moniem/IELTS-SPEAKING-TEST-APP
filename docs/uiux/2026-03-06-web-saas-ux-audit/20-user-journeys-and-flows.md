# User Journeys and Flows

## Actors

- Primary actor: IELTS learner
- Secondary actor: prospective learner evaluating the platform
- Internal/system actor: auth, billing, and session-resume services

## Primary Journey: Marketing to First Meaningful Session

Goal:

- Move a new visitor from discovery to registration to a first high-value learner action.

Entry points:

- Organic search
- Guide article
- Pricing page
- Direct visit

Happy path:

1. User lands on home or guide page.
2. User understands the promise and trusts the platform enough to continue.
3. User reaches pricing or register.
4. User creates an account.
5. User lands on dashboard.
6. User sees one clear "start here" action.
7. User completes a speaking practice or full exam baseline.
8. User receives a result and a recommended next step.

Current friction:

- Marketing pages explain features but do not fully resolve "why trust this" or "which plan is right for me."
- Registration is visually clean but still asks for optional fields before value is proven.
- Dashboard shows multiple good actions instead of one strongest activation path.

Instrumentation hooks:

- `marketing_home_cta_click`
- `pricing_plan_select`
- `register_started`
- `register_completed`
- `dashboard_first_cta_click`
- `first_session_started`
- `first_session_completed`
- `first_feedback_viewed`

Diagram:

- `diagrams/marketing-acquisition-to-activation.mmd`

## Secondary Journey: Returning Learner Practice Loop

Goal:

- Help a returning learner resume progress with minimal decision cost.

Entry points:

- Dashboard
- Deep link into a module
- Resume session state

Happy path:

1. Learner opens dashboard.
2. Learner sees current goal, weakest module, and resume state.
3. Learner enters a module with context already set.
4. Learner completes practice.
5. Learner sees score, weakness summary, and a next action.
6. Learner either repeats practice or moves to related content.

Current friction:

- Module pages are capable, but they still expose setup and system detail more than a guided coaching loop.
- Results exist, but next-step guidance is not dominant enough.

Instrumentation hooks:

- `resume_notice_shown`
- `resume_clicked`
- `module_session_started`
- `manual_fallback_used`
- `module_feedback_cta_clicked`

Diagram:

- `diagrams/learner-practice-to-feedback.mmd`

## Failure and Recovery Journey: Interrupted Full Exam

Goal:

- Preserve trust and continuity when a learner is interrupted during a high-stakes full exam.

Happy path:

1. Learner starts a full exam.
2. Session state is saved continuously.
3. Learner is interrupted.
4. Learner returns and sees a clear resume state.
5. Learner resumes at the exact right section.

Failure points to handle clearly:

- Session expired
- Network failure
- Audio permission denied
- Device change
- Learner chooses to discard progress

Recovery requirements:

- Explain what is saved
- Explain what is not saved
- Offer a clear resume action
- Offer a safe discard action

Instrumentation hooks:

- `exam_interrupted`
- `exam_resume_prompt_shown`
- `exam_resumed`
- `exam_resume_discarded`
- `exam_resume_failed`

Diagram:

- `diagrams/full-exam-resume-recovery.mmd`

## Web Differences Worth Calling Out

- Marketing needs a usable mobile nav before it can really support mobile acquisition.
- Learner shell needs a different navigation model on small screens.
- Dense cards, tables, and side rails should collapse into one-column priority stacks on mobile web.
