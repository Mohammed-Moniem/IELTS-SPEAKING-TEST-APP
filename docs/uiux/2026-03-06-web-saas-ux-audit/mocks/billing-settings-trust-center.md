# Mock Spec: Billing and Settings Trust Center

## Screen purpose

- Help learners manage plan and preferences confidently without exposing internal implementation detail.

## Content hierarchy

1. Current plan and what it unlocks
2. Usage progress with plain-language explanation
3. Billing actions
4. Preference controls
5. Support and recovery links

## Primary actions

- Manage billing
- Upgrade plan
- Save preferences

## Secondary actions

- View usage limits
- Contact support
- Learn what browser notifications do

## Validation and error states

- Billing action failure:
  - say what failed and what the user should do next
- Unsupported notification environment:
  - explain limitation in plain language and offer alternatives

## Empty, loading, success, failure states

- Loading:
  - preserve plan summary skeleton
- Success:
  - "Your plan has been updated"
- Failure:
  - "We could not open billing right now. Try again or contact support."

## Accessibility notes

- Status badges must not be the only place state is conveyed
- Toggle rows need clear label, status text, and focus treatment
- Error and success messages should be announced for assistive technology

## Copy direction

- Replace:
  - "Full local test-mode flow"
  - "Mode: test"
  - "Study Defaults (UI Only)"
- With:
  - "Manage your plan and usage"
  - "Your current plan"
  - "Study preferences"
