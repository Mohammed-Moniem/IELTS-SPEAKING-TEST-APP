# Mock Spec: Learner Dashboard Focus Mode

## Screen purpose

- Help a learner understand what to do right now in less than 5 seconds.

## Content hierarchy

1. Daily objective card
2. Resume session card
3. Weakest-skill recommendation
4. Upcoming exam or target band context
5. Lightweight progress summary
6. History and upsell content below the fold

## Primary actions

- Resume current session
- Start today's recommended practice

## Secondary actions

- Open full study plan
- View progress details

## Validation and error states

- If progress data is sparse:
  - explain what activity unlocks better recommendations
- If no active session:
  - convert resume area into "start baseline" or "start today's task"

## Empty, loading, success, failure states

- Loading:
  - skeleton preserves card structure
- Empty:
  - one CTA, one explanation, one expected benefit
- Success:
  - completed session updates streak and next action immediately
- Failure:
  - preserve learner intent and offer retry

## Accessibility notes

- Primary CTA must stay visible without horizontal overflow on small screens
- Sidebar becomes drawer or bottom nav on mobile
- Progress labels cannot rely on color alone

## Proposed modules

- Today card:
  - "Today: Speaking Part 2 fluency drill"
  - "12 min"
  - "Improves your weakest criterion"
- Resume card:
  - percent complete
  - time remaining
  - continue CTA
- Improvement card:
  - one criterion weakness
  - one reason
  - one action
