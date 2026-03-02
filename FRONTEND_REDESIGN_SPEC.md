# Spokio IELTS App — Complete Frontend Redesign Specification

> **Purpose:** This document serves as the comprehensive prompt/spec for an AI agent to redesign every page and modal in the Spokio IELTS preparation platform. Each section describes one page or component: its route, layout, data requirements, API contracts, UI elements, state management, modals, conditional logic, and navigation.

> **Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS. Backend is Express.js with JWT auth. All API calls go through a centralized `webApi` client and `apiRequest()` helper.

---

## Table of Contents

1. [Global Architecture](#1-global-architecture)
2. [Shared UI Components (v2 Design System)](#2-shared-ui-components)
3. [Authentication Pages](#3-authentication-pages)
4. [Marketing Pages](#4-marketing-pages)
5. [Learner Dashboard & Progress](#5-learner-dashboard--progress)
6. [IELTS Module Pages](#6-ielts-module-pages)
7. [History Detail Pages](#7-history-detail-pages)
8. [Library Pages](#8-library-pages)
9. [Gamification Pages](#9-gamification-pages)
10. [Account & Billing Pages](#10-account--billing-pages)
11. [Admin Pages](#11-admin-pages)
12. [Layout Shells](#12-layout-shells)
13. [Complete API Reference](#13-complete-api-reference)
14. [Complete Type Reference](#14-complete-type-reference)

---

## 1. Global Architecture

### Routing Groups
The app uses Next.js route groups to separate concerns:
- `/(marketing)` — Public pages: home, auth, pricing, blog, about, etc.
- `/(learner)/app` — Authenticated learner experience: dashboard, modules, library, gamification, settings
- `/(admin)/admin` — Admin panel: overview, analytics, content management, users, partners

### Authentication Flow
- `AuthProvider` (React Context) wraps the entire app
- Tokens stored in localStorage via `session.ts`
- API client auto-injects Bearer token; retries with refresh on 401
- `AppConfig` loaded after login contains: roles, subscription plan, usage summary, feature flags, partner portal status

### State Management
- All pages use local `useState` + `useEffect` for data fetching
- No global state library — auth context is the only shared state
- API responses cached per-page, re-fetched on mount or filter change

---

## 2. Shared UI Components

These are the reusable building blocks from `src/components/ui/v2/index.tsx`. Every page uses a subset of these.

### PageHeader
```
Props: { title: string; subtitle?: string; actions?: ReactNode; kicker?: string }
```
Renders a page-level header with optional kicker badge, title, subtitle, and action buttons area.

### MetricCard
```
Props: { label: string; value: ReactNode; helper?: ReactNode; delta?: ReactNode; tone?: Tone }
Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
```
A KPI card showing a label, large value, optional delta indicator, and helper text. Tone controls color accent.

### StatusBadge
```
Props: { tone?: Tone; children: ReactNode }
```
Inline badge/pill with tone-based coloring for status indicators.

### SectionCard
```
Props: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }
```
Bordered card container with optional header row (title + actions). Used to group related content.

### SegmentedTabs
```
Props: { options: Array<{ value: T; label: string }>; value: T; onChange: (next: T) => void }
```
Horizontal segmented control / tab bar. Active segment gets highlighted styling.

### SkeletonSet
```
Props: { rows?: number } // default 4
```
Loading placeholder with animated skeleton rows.

### EmptyState
```
Props: { title: string; body?: string; action?: ReactNode }
```
Centered card for when no data is available. Shows title, optional body text, and optional action button.

### ErrorState
```
Props: { title?: string; body?: string; onRetry?: () => void; retryLabel?: string }
```
Red-bordered card for error display with optional retry button.

### BlockedState
```
Props: { title: string; body?: string; action?: ReactNode }
```
Amber-bordered card for feature-blocked or permission-denied states.

### SessionStatusStrip
```
Props: { timerLabel: string; completionLabel: string; unsolvedLabel: string; actions?: ReactNode }
```
Horizontal status bar used during active test sessions. Shows timer, completion %, and unsolved count as colored badges. Actions slot on the right for prev/next/review buttons.

### ModalConfirm (Dialog)
```
Props: {
  title: string; subtitle?: string;
  confirmLabel: string; cancelLabel?: string;
  onCancel: () => void; onConfirm: () => void;
  disabled?: boolean; children?: ReactNode
}
```
Full-screen backdrop modal with header, optional body content, and confirm/cancel action buttons. Used for destructive or high-stakes confirmations throughout the app.

---

## 3. Authentication Pages

### 3.1 Login Page

**Route:** `/login`
**Layout Group:** `(marketing)`

**Purpose:** Authenticate existing users with email and password.

**UI Elements:**
- Centered card container with rounded borders and shadow
- Email input field with label and error state (red border/text on validation failure)
- Password input field with label
- "Forgot password?" link below password field → navigates to `/forgot-password`
- Submit button — shows "Signing in..." text and disabled state during submission
- General error alert box (red background) at top of form when API returns error
- "Don't have an account? Register" link at bottom → navigates to `/register`

**State:**
```typescript
email: string                    // Email input value
password: string                 // Password input value
error: string                    // General error message from API
fieldErrors: Record<string, string>  // Per-field validation errors
isSubmitting: boolean            // True during API call
```

**API Call:**
- `useAuth().login(email, password)` → calls `POST /auth/login`
- On success: redirects to query param `?next=` (defaults to `/app/dashboard`)
- On failure: sets `error` with API error message

**Validation (via `validateLogin`):**
- Email: required, must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: required, non-empty

**Loading State:** Suspense wrapper with skeleton fallback.

---

### 3.2 Register Page

**Route:** `/register`
**Layout Group:** `(marketing)`

**Purpose:** Create a new user account.

**UI Elements:**
- 2-column grid for first name and last name inputs
- Email input
- Password input (with strength requirements shown on error)
- Phone input (optional)
- 2-column grid for referral code and partner code inputs (optional)
- Submit button with loading state
- Error alert box
- "Already have an account? Log in" link → `/login`

**State:**
```typescript
firstName: string
lastName: string
email: string
password: string
phone: string                   // Optional
referralCode: string            // Optional, auto-filled from ?ref= or ?referral= query param
partnerCode: string             // Optional, auto-filled from ?partner= query param
error: string
fieldErrors: Record<string, string>
isSubmitting: boolean
```

**Query Parameter Pre-fill:**
- `?ref=ABC` or `?referral=ABC` → sets referralCode to "ABC" (uppercased)
- `?partner=XYZ` → sets partnerCode to "XYZ" (uppercased)

**API Call:**
- `useAuth().register({ firstName, lastName, email, password, phone, referralCode, partnerCode })` → calls `POST /auth/register`
- On success: redirects to `/app/dashboard`

**Validation (via `validateRegister`):**
- First name: required, min 2 chars
- Last name: required, min 2 chars
- Email: required, valid format
- Password: required, 8-128 chars, must contain lowercase + uppercase + digit + special char (`!@#$%^&*`)

---

### 3.3 Forgot Password Page

**Route:** `/forgot-password`
**Layout Group:** `(marketing)`

**Purpose:** Request a password reset email.

**UI Elements:**
- Email input field
- Submit button
- Error alert (only shows on 5xx server errors)
- **Success state:** Replaces form with confirmation card showing "mark_email_read" icon, success title, instruction text, and link back to `/login`
- "Back to login" link

**State:**
```typescript
email: string
error: string
fieldErrors: Record<string, string>
success: boolean                // Toggles between form and success view
isSubmitting: boolean
```

**API Call:**
- `POST /auth/forgot-password` with `{ email }` (auth optional)
- **Security:** Always shows success message regardless of whether email exists (prevents enumeration)

**Conditional Rendering:**
- `success === false` → show email form
- `success === true` → show confirmation card with icon

---

### 3.4 Reset Password Page

**Route:** `/reset-password`
**Layout Group:** `(marketing)`

**Purpose:** Set a new password using a reset token from email.

**UI Elements:**
- New password input
- Confirm password input
- Submit button with loading state
- Error alert
- **Success state:** Checkmark icon, "Password Reset" title, link to `/login`
- **Invalid token state:** "link_off" icon, error message, link to `/forgot-password`

**State:**
```typescript
password: string
confirmPassword: string
error: string
fieldErrors: Record<string, string>
success: boolean
isSubmitting: boolean
```

**Query Parameters:**
- `?token=xxx` — required reset token from email link

**API Call:**
- `POST /auth/reset-password` with `{ token, password }` (auth optional)

**Validation (via `validateResetPassword`):**
- Password: required, 8-128 chars, must contain lowercase + uppercase + digit + special char
- Confirm password: required, must match password

**Conditional Rendering (3 states):**
1. No token → "link_off" icon with invalid link message
2. Form → password fields and submit button
3. Success → checkmark icon with confirmation

---

### 3.5 Email Verification Page

**Route:** `/verify-email`
**Layout Group:** `(marketing)`

**Purpose:** Verify email address from a link sent after registration.

**UI Elements:**
- **Verifying state:** Spinning icon, "Verifying your email..." message
- **Success state:** Green checkmark icon, "Email Verified" title, link to `/app/dashboard`
- **Error state:** Red error icon, error message, link to `/app/settings`

**State:**
```typescript
status: 'verifying' | 'success' | 'error'
errorMessage: string
```

**Query Parameters:**
- `?token=xxx` — required verification token

**API Call (on mount via useEffect):**
- `POST /auth/verify-email` with `{ token }` (auth optional)
- Automatically triggers on page load — no user interaction needed

**Conditional Rendering (3 states):**
1. `verifying` → spinner + "Please wait"
2. `success` → green check + link to dashboard
3. `error` → red icon + error message + link to settings

---

## 4. Marketing Pages

### 4.1 Home Page

**Route:** `/` (root)
**Layout Group:** `(marketing)`

**Purpose:** Landing page showcasing the platform's value proposition.

**UI Elements (all static — no API calls):**
- **Hero section:** Gradient background (violet), 2/3 width main content + 1/3 sidebar card
  - Main: headline, description, two CTA buttons ("Start Free Practice" → `/register`, "View Plans" → `/pricing`)
  - Sidebar: "Outcome Snapshot" card showing key metrics
- **Value Grid:** 4-column layout with pillar cards, each with icon, title, description
  - Pillars: AI-powered feedback, Full exam simulation, Adaptive learning, Progress analytics
- **Journey Section:** "How Learners Use Spokio" — 3-step horizontal cards
- **Guarantee Section:** Gradient background, band score improvement guarantee summary, link to `/guarantee`
- **CTA Section:** Final call-to-action with register button

**SEO:**
- Structured data: Organization + WebSite schemas
- Open Graph + Twitter card metadata

**Navigation Links:** `/register`, `/pricing`, `/ielts`, `/app/dashboard`, `/admin/overview`, `/guarantee`

---

### 4.2 About Page

**Route:** `/about`

**Purpose:** Explain the platform's philosophy, quality standards, and current boundaries.

**UI Elements (static):**
- Hero section with gradient background
- "What We Optimize For" card with feature list
- "How We Protect Reliability" card with quality control list
- "Current V1 Boundaries" card with limitations

**Navigation:** `/methodology`, `/editorial-policy`, `/features`, `/ielts`

---

### 4.3 Features Page

**Route:** `/features`

**Purpose:** Showcase all platform features organized by module.

**UI Elements (static with data arrays):**
- Hero section
- 3-column card grid with 8 feature cards:
  1. Speaking Practice (AI feedback, pronunciation analysis)
  2. Writing Tasks (Task 1 & 2, band-scored evaluation)
  3. Reading Tests (Academic & General, timed passages)
  4. Listening Tests (Audio-based, section scoring)
  5. Full Exam Simulations (Multi-module timed exams)
  6. Progress & Analytics (Band tracking, predictions)
  7. Partner Program (Referral commissions)
  8. Admin Suite (Content management, analytics)
- "How This Improves IELTS Score Consistency" section
- "IELTS Strategy Guides" section with 4 guide highlight cards (from `ieltsGuides` data)
- "Built for Staged Rollout" section

**SEO:** ItemList structured data

**Navigation:** `/ielts/{slug}`, `/ielts`, `/pricing`

---

### 4.4 Pricing Page

**Route:** `/pricing`

**Purpose:** Display subscription tiers with features, limits, and pricing.

**UI Elements (static with plan data):**
- Hero section
- **4-column pricing card grid:**

| Plan | Monthly | Annual | Highlights |
|------|---------|--------|-----------|
| Free | $0 | — | 1 full test + limited sessions |
| Premium | $14/mo | $140/yr | Expanded usage, "Most Popular" badge |
| Pro | $29/mo | $290/yr | Includes guarantee, "Guarantee" badge |
| Team | $79/mo | $790/yr | Operational support |

Each card shows: tier name, price, feature bullet list, "Choose" button → `/register`

- **Band Score Improvement Guarantee** section (links to `/guarantee`)
- **"Choose by Exam Timeline"** section — 3-column guide (1-2 weeks, 1-2 months, 3+ months)
- **"Choose by Preparation Intensity"** section — 2-column comparison
- **"Preparation Guides Linked to Plans"** section

**SEO:** SoftwareApplication structured data with Offer objects per plan

---

### 4.5 Methodology Page

**Route:** `/methodology`

**Purpose:** Explain how IELTS band scores are evaluated by the AI.

**UI Elements (static):**
- Hero section
- "Module Evaluation Principles" card — per-module scoring criteria
- "Quality and Guardrails" card — AI quality controls
- "Interpretation Guidance" card — how to read scores

**Navigation:** `/editorial-policy`, `/ielts`, `/pricing`

---

### 4.6 Guarantee Page

**Route:** `/guarantee`

**Purpose:** Detail the band score improvement guarantee terms.

**UI Elements (static with data arrays):**
- Hero section (emerald gradient theme)
- **"How It Works"** — 4-step grid with detail cards
- **"Eligibility Requirements"** — 5-item checklist
  - 90-day commitment, 3+ sessions/week, Pro plan, etc.
- **FAQ section** — 6 Q&A pairs with divider styling
- CTA section → `/register`, `/pricing`

---

### 4.7 Contact Page

**Route:** `/contact`

**Purpose:** Provide support contact channels.

**UI Elements (static):**
- Hero section
- "Support Channels" card:
  - support@spokio.app — general support
  - partnerships@spokio.app — partnerships
- "Before You Contact Us" card — guidance text

**Navigation:** `/pricing`, `/ielts`, `/register`

**SEO:** ContactPage structured data with ContactPoint objects

---

### 4.8 Advertise Page

**Route:** `/advertise`

**Purpose:** Advertiser onboarding page with inventory and package details.

**UI Elements (static with data arrays):**
- Hero section (indigo/cyan gradient)
- **"Product Inventory"** — 5 ad placement types with audience info
- **"Package Catalog"** — 4 sponsorship tiers:
  - Coach Starter: $149/mo
  - Institute Growth: $499/mo
  - Premium Spotlight: $999/mo
  - Enterprise Custom: custom
- **"Policy and Approval"** card — creative review, safety rules
- **"Onboarding Flow"** card — step-by-step process

**Stats:** 110K+ monthly page views, 38K+ active learners, 4 core modules

**Navigation:** `/register`, `/contact`

---

### 4.9 Editorial Policy Page

**Route:** `/editorial-policy`

**Purpose:** Describe content creation and review standards.

**UI Elements (static):**
- Hero section
- "How Content Is Created" card
- "Review and Update Standards" card
- "Corrections Process" card (contact: support@spokio.app)

**Navigation:** `/methodology`, `/ielts`, `/contact`

---

### 4.10 Blog Index Page

**Route:** `/blog`
**Component:** `BlogIndexPage` (from `src/components/blog/BlogIndexPage.tsx`)

**Purpose:** List all published blog posts with cluster filtering.

**UI Elements:**
- Hero section with gradient (violet to indigo)
- **Cluster filter pills** — dynamically derived from post data using Set. "All clusters" + unique cluster names. Active pill gets violet background.
- **Blog post grid** — 3-column responsive (1 col mobile, 2 tablet, 3 desktop)
  - Each card: cluster badge, state badge (colored by tone), title (h2), excerpt (3-line clamp), dates, "Read article →" button

**State:**
```typescript
posts: BlogPostSummary[]
cluster: string                 // 'all' or specific cluster name
loading: boolean
error: string
```

**API Call:**
- `webApi.listBlogPosts({ cluster?, limit: 100, offset: 0 })` — auth optional

**State Badge Tones:**
- idea/outline → info, draft/pending_review → warning, qa_passed/published → success, archived → neutral

**Navigation:** Each card links to `/blog/{post.slug}`

---

### 4.11 Blog Post Detail Page

**Route:** `/blog/[slug]`
**Component:** `BlogPostPage` (from `src/components/blog/BlogPostPage.tsx`)

**Purpose:** Display a single blog article.

**UI Elements:**
- Back link → `/blog`
- Article container card with:
  - Cluster badge, published/reviewed dates
  - Title (h1), excerpt paragraph
  - Tags as small badges
  - **Article body** — custom markdown-to-HTML renderer:
    - `#` → h2, `##` → h3, `###` → h4
    - `**bold**`, `*italic*`, `[text](url)` → links open in new tab
    - Double newlines → paragraphs
  - **CTA card** at bottom: "Use this strategy in Spokio" with buttons → `/app/dashboard`, `/pricing`

**State:**
```typescript
post: BlogPostDetail | null
loading: boolean
error: string
```

**API Call:**
- `webApi.getBlogPost(slug)` — auth optional

**SEO:** Article structured data (JSON-LD) with headline, dates, section, keywords

---

### 4.12 IELTS Guides Index

**Route:** `/ielts`

**Purpose:** Hub page for IELTS preparation strategy guides. Uses static data from `ieltsGuides.ts`.

---

### 4.13 IELTS Guide Detail

**Route:** `/ielts/[slug]`

**Purpose:** Individual IELTS guide content page. Static data rendered from guide metadata.

---

## 5. Learner Dashboard & Progress

### 5.1 Dashboard Page

**Route:** `/app/dashboard`
**Layout Group:** `(learner)`

**Purpose:** Main learner hub showing KPIs, quick practice, resume, recommendations, and recent activity.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: "Welcome back, {name}" + [Start New Test] btn│
├──────────┬──────────┬──────────┬─────────────────────┤
│ Avg Band │ Streak   │ Tests    │ Next Goal           │
│ (KPI)    │ (KPI)    │ (KPI)    │ (KPI)               │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Quick Practice (2-col grid)     │ Sidebar Rail        │
│ ┌─────────┐ ┌─────────┐       │ ┌─────────────────┐ │
│ │Speaking  │ │Writing  │       │ │Resume Session   │ │
│ │(violet)  │ │         │       │ │(progress bar)   │ │
│ ├─────────┤ ├─────────┤       │ ├─────────────────┤ │
│ │Reading  │ │Listening│       │ │Recommended (x3) │ │
│ └─────────┘ └─────────┘       │ ├─────────────────┤ │
│                                │ │Premium Upsell   │ │
│                                │ └─────────────────┘ │
├────────────────────────────────┴─────────────────────┤
│ Recent Activity Table (6 rows max)                   │
│ Module | Topic | Date | Score | Status               │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
view: LearnerDashboardView | null
loading: boolean
error: string
```

**API Call:**
- `webApi.getLearnerDashboardView()` → `GET /app/dashboard-view`

**Data Shape — `LearnerDashboardView`:**
```typescript
{
  generatedAt: string
  plan: SubscriptionPlan
  kpis: {
    averageBand: number          // e.g. 6.5
    currentStreak: number        // days
    testsCompleted: number
    nextGoalBand: number         // e.g. 7.0
  }
  quickPractice: Array<{
    module: IELTSModule
    title: string
    description: string
    href: string                 // e.g. "/app/speaking"
  }>
  resume: {                      // null if no in-progress session
    type: 'exam' | 'simulation' | 'practice'
    examId?: string
    simulationId?: string
    sessionId?: string
    title: string
    subtitle: string
    progressPercent: number
    href: string
  } | null
  recommended: Array<{
    topicId: string
    slug: string
    title: string
    description?: string
    part: number
    difficulty?: string
  }>
  activity: Array<{
    module: IELTSModule
    itemId: string
    title: string
    subtitle?: string
    status: string
    score: number
    durationSeconds: number
    createdAt: string
    href: string
  }>
}
```

**Conditional Rendering:**
- Resume card only shows if `view.resume !== null`
- Activity table hidden if no view data
- Skeleton loaders while loading

**Navigation:**
- "Start New Test" → `/app/tests`
- Quick practice cards → `/app/speaking`, `/app/writing`, `/app/reading`, `/app/listening`
- Activity rows → dynamic `href` from data
- Recommended items → topic-specific links

---

### 5.2 Progress Page

**Route:** `/app/progress`

**Purpose:** Detailed analytics with band trends, skill breakdown, strength map, and improvement plan.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header + Range filter (7d|30d|90d) + Module filter   │
│         + Export button                              │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Overall  │ Predicted│ Tests    │ Study Time          │
│ Band     │ Score    │ Completed│ (hours)             │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Band Score Trend (SVG line chart with grid)          │
├──────────────────────────────────────────────────────┤
│ Skill Breakdown (radar chart + legend)               │
├──────────────────────────────────────────────────────┤
│ History & Attempts Table (10 items)                  │
│ Module | Test/Topic | Date | Duration | Score | Stat │
├──────────────────────────┬───────────────────────────┤
│ Strength Map             │ Improvement Plan          │
│ - Criteria list          │ - Action cards            │
│ - Score + confidence     │ - Expected impact         │
│ - Library links          │ - Recommended action      │
│                          │ - Export JSON/CSV buttons  │
└──────────────────────────┴───────────────────────────┘
```

**State:**
```typescript
range: '7d' | '30d' | '90d'
module: 'all' | 'speaking' | 'writing' | 'reading' | 'listening'
view: LearnerProgressView | null
strengthMap: StrengthMapView | null
improvementPlan: ImprovementPlanView | null
loading: boolean
error: string
```

**API Calls (3 parallel):**
1. `webApi.getLearnerProgressView({ range, module })` → `GET /app/progress-view`
2. `webApi.getStrengthMap(range)` → `GET /app/insights/strength-map`
3. `webApi.getImprovementPlan(module)` → `GET /app/insights/improvement-plan`

**Data Shapes:**

`LearnerProgressView`:
```typescript
{
  range: string
  module: string
  totals: { overallBand, predictedScore, testsCompleted, studyHours }
  trend: Array<{ date: string; score: number; target: number }>
  skillBreakdown: { speaking, writing, reading, listening: number }
  attempts: Array<{ module, itemId, title, subtitle?, status, score, durationSeconds, createdAt, href }>
}
```

`StrengthMapView`:
```typescript
{
  dataSufficiency: 'low' | 'medium' | 'high'
  criteria: Array<{
    key: string; module: IELTSModule; label: string
    averageScore: number; confidence: 'low'|'medium'|'high'; dataPoints: number
  }>
}
```

`ImprovementPlanView`:
```typescript
{
  predictionConfidence: 'low' | 'medium' | 'high'
  cards: Array<{
    criterionKey, module, title, currentBand, expectedBandImpact,
    recommendedAction, deepLink
  }>
}
```

**Export Functions:**
- `exportInsightsJson()` — downloads JSON file
- `exportInsightsCsv()` — downloads CSV file

---

### 5.3 Study Plan Page

**Route:** `/app/study-plan`

**Purpose:** Personalized study plan based on current skills and target band.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header + Target Band selector (5.0 - 9.0)           │
├──────────┬──────────┬────────────────────────────────┤
│ Current  │ Target   │ Weekly Study Plan              │
│ Band     │ Band+Gap │ (total hours)                  │
├──────────┴──────────┴────────────────────────────────┤
│ Skill Breakdown (4 horizontal progress bars)         │
│ Each: current vs target, priority badge              │
├──────────────────────────────────────────────────────┤
│ Weekly Focus Areas (4 cards, 1 per skill)            │
│ Each: icon, current band, gap, weekly mins,          │
│        priority badge, 3 tips, action buttons        │
├──────────────────────────────────────────────────────┤
│ Suggested Weekly Schedule (7-day grid)               │
├──────────────────────────────────────────────────────┤
│ [View Full Progress]  [Start Practicing Now]         │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
view: LearnerProgressView | null
loading: boolean
error: string
targetBand: number              // User-adjustable, default auto-set from data
```

**API Call:**
- `webApi.getLearnerProgressView({ range: '90d', module: 'all' })`

**Computed State:**
- `recommendations` array built from skillBreakdown — each contains:
  - skill, icon, label, band, gap, priority ('Critical'|'High'|'Medium'|'On Track'), tips (3), actions, weeklyMinutes
- `totalWeeklyMinutes` — sum of all skill recommendations
- Priority levels determined by gap to target band
- Color-coded by skill: speaking=violet, writing=blue, reading=amber, listening=emerald

**Navigation:**
- Skill practice buttons → `/app/{skill}`
- Full exam button → `/app/tests`
- "View Full Progress" → `/app/progress`

---

## 6. IELTS Module Pages

### 6.1 Speaking Page

**Route:** `/app/speaking`

**Purpose:** Speaking practice with three modes: Practice (topic library), Simulation (full 3-part exam), and Quick (single question).

**UI Layout — Tabbed Interface:**
```
┌──────────────────────────────────────────────────────┐
│ [Practice] [Simulation] [Quick]    Device: [dropdown]│
├──────────────────────────────────────────────────────┤
│                                                      │
│  TAB-SPECIFIC CONTENT (see below)                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**State (extensive — this is the most complex page):**
```typescript
// Tab & UI
activeTab: 'practice' | 'simulation' | 'quick'
errorMessage: string
deviceId: string                           // Selected microphone
devices: MediaDeviceInfo[]                 // Available audio devices
recorderState: 'idle' | 'recording' | 'uploading' | 'error'

// Practice tab
topicCategory: string                      // 'all' | 'part1' | 'part2' | 'part3'
topics: PracticeTopic[]
topicSearch: string
topicsOffset: number
hasMoreTopics: boolean
topicLoading: boolean
practiceSession: PracticeSessionStartPayload | null
practiceResult: PracticeSession | null
practiceTranscription: string
practiceManualResponse: string
practiceHistory: PracticeSession[]
practiceElapsed: number                    // Timer seconds

// Simulation tab
simulation: SimulationStartPayload | null
simulationResult: SimulationSession | null
simulationHistory: SimulationSession[]
simulationPartIndex: number
simulationResponses: Record<number, string>
simulationTimeSpent: Record<number, number>
simulationElapsed: number

// Quick tab
quickQuestion: string
quickTranscript: string
quickEvaluation: SpeakingEvaluation | null
ttsAudioUrl: string
```

**Practice Tab UI:**
- Category filter buttons (All, Part 1, Part 2, Part 3)
- Search input for topics
- Topic cards grid — each shows title, part, difficulty, isPremium badge
- Click topic → start practice session
- Active practice: question display, recording controls (record/stop/upload), manual text input fallback, timer
- Result panel: band score, feedback breakdown (fluency, lexical, grammar, pronunciation), strengths, improvements
- Practice history table

**Simulation Tab UI:**
- "Start Simulation" button
- Active simulation: part-by-part navigation (Part 1 → 2 → 3)
- Per-part: question display, recording/text input, timer
- Complete simulation: overall band, per-part feedback
- Simulation history table

**Quick Tab UI:**
- Random question with TTS audio playback
- Record response or type manually
- Evaluation display: overall band, criteria scores, corrections, suggestions

**API Calls:**
- `GET /topics/practice?category={cat}&search={q}&limit=20&offset={n}` → PracticeTopicPage
- `POST /speaking/practice/start` with `{ topicId }` → PracticeSessionStartPayload
- `POST /speaking/practice/{id}/submit` with `{ response, durationSeconds }` → PracticeSession
- `POST /speaking/simulation/start` → SimulationStartPayload
- `POST /speaking/simulation/{id}/submit` with `{ responses, timeSpent }` → SimulationSession
- `POST /speaking/quick/evaluate` with `{ response }` → SpeakingEvaluation

**Audio/Media:**
- MediaRecorder API for microphone capture
- Device enumeration with `navigator.mediaDevices.enumerateDevices()`
- Audio → base64 encoding for upload
- TTS synthesis for question audio playback
- Microphone permission error handling

---

### 6.2 Writing Page

**Route:** `/app/writing`

**Purpose:** Writing practice for IELTS Task 1 and Task 2 with real-time editing and AI evaluation.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Track: [Academic|General]  Task: [Task 1|Task 2]     │
│ [Generate Task]                                      │
├──────────────────────────────────────────────────────┤
│ SessionStatusStrip: Timer | Word Count | Unsolved    │
├──────────────┬─────────────────────┬─────────────────┤
│ Task Brief   │ Editor              │ Score Breakdown  │
│ - Track      │ - Toolbar           │ (when submitted) │
│ - Type       │ - Textarea          │ - Overall Band   │
│ - Title      │                     │ - TR / CC        │
│ - Prompt     │                     │ - LR / GRA       │
│ - Instruct.  │                     │ - Feedback       │
│ - Require.   │                     │ - Suggestions    │
├──────────────┴─────────────────────┴─────────────────┤
│ Footer: Word count | [Save Draft] [Submit]           │
├──────────────────────────────────────────────────────┤
│ History Table: ID | Band | Created | Actions         │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
track: 'academic' | 'general'
taskType: 'task1' | 'task2'
task: WritingTask | null
responseText: string
result: WritingSubmission | null
history: WritingSubmission[]
selectedSubmission: WritingSubmission | null
timerSecondsLeft: number
elapsedSeconds: number
error: string
loading: boolean
isAutosaved: boolean
```

**API Calls:**
- `POST /writing/tasks/generate` with `{ track, taskType }` → WritingTask
- `POST /writing/submissions` with `{ taskId, track, taskType, response, durationSeconds }` → WritingSubmission
- `GET /writing/submissions/{id}` → WritingSubmission
- `GET /writing/history?track={t}&taskType={tt}&limit=20` → WritingSubmission[]

**Local Storage:**
- Auto-saves draft to `spokio.writing.draft.{taskId}`
- Recovery key: `spokio.writing.recovery`

**Key Features:**
- Countdown timer per task (from `suggestedTimeMinutes`)
- Word count tracking with minimum words validation
- Pre-task guidance cards shown before generating a task

---

### 6.3 Reading Page

**Route:** `/app/reading`

**Purpose:** Reading comprehension tests with passage display and question navigation.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Track: [Academic|General]  [Start Reading Test]      │
├──────────────────────────────────────────────────────┤
│ SessionStatusStrip: Timer | Completion% | Unsolved   │
│                     [Prev] [Next] [Review]           │
├──────────────────────┬───────────────────────────────┤
│ Passage Panel        │ Questions Sidebar             │
│ - Full passage text  │ - Progress card               │
│ - Highlight controls │ - Review mode card (if on)    │
│ - Zoom in/out        │ - Current question card       │
│                      │ - Question navigator grid     │
│                      │   (numbered buttons showing   │
│                      │    answered/unanswered status) │
├──────────────────────┴───────────────────────────────┤
│ Bottom: [Prev] [Next] [Submit All]                   │
├──────────────────────────────────────────────────────┤
│ History Table: Attempt | Status | Band | Created     │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
track: 'academic' | 'general'
attemptId: string
test: ObjectiveTestPayload | null
answers: Record<string, string>        // questionId → answer
result: ObjectiveAttempt | null
history: ObjectiveAttempt[]
activeQuestionIndex: number
reviewMode: boolean
timerSecondsLeft: number
elapsedSeconds: number
error: string
loading: boolean
```

**API Calls:**
- `POST /reading/tests/start` with `{ track }` → `{ attemptId, ...ObjectiveTestPayload }`
- `POST /reading/tests/{attemptId}/submit` with `{ answers: [{questionId, answer}] }` → ObjectiveAttempt
- `GET /reading/tests/{attemptId}` → ObjectiveAttempt
- `GET /reading/history?track={t}&limit=10` → ObjectiveAttempt[]

**Question Types:**
- **Multiple choice (MCQ):** Radio buttons from `options[]`
- **Text input:** Free-text answer when `options` is null/empty

**Auto-Submit:** Automatically submits when timer hits 0.

---

### 6.4 Listening Page

**Route:** `/app/listening`

**Purpose:** Listening comprehension tests with audio playback and question navigation.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Track: [Academic|General]  [Start Listening Test]    │
├──────────────────────────────────────────────────────┤
│ Audio Player Card (with progress bar)                │
├──────────────────────────────────────────────────────┤
│ SessionStatusStrip + Navigation                      │
├──────────────────────┬───────────────────────────────┤
│ Question Card        │ Sidebar                       │
│ - MCQ or text input  │ - Test Progress bar           │
│ - Review mode card   │ - Question Navigator grid     │
│                      │ - Transcript Preview          │
├──────────────────────┴───────────────────────────────┤
│ History Table                                        │
└──────────────────────────────────────────────────────┘
```

**State:** Same structure as Reading page, plus audio-specific handling.

**API Calls:**
- `POST /listening/tests/start` with `{ track }` → `{ attemptId, audioUrl?, transcript?, ...ObjectiveTestPayload }`
- `POST /listening/tests/{attemptId}/submit` with `{ answers }` → ObjectiveAttempt
- `GET /listening/tests/{attemptId}` → ObjectiveAttempt
- `GET /listening/history?track={t}&limit=10` → ObjectiveAttempt[]

**Audio Features:**
- HTML5 `<audio>` element with custom progress bar
- Fallback transcript display if audio unavailable

---

### 6.5 Full Exam Page

**Route:** `/app/tests`

**Purpose:** Multi-module timed IELTS exam simulation (Speaking → Writing → Reading → Listening).

**UI States:**

**State 1 — No Active Exam:**
- 4 module overview cards
- "Start Full Exam" button
- Resume card (if existing exam in progress)

**State 2 — Active Exam:**
- Module tabs/nav showing progress per module
- SessionStatusStrip with per-module progress
- Module-specific content renders inline:
  - Speaking: recording interface
  - Writing: editor with task brief
  - Reading: passage + questions split view
  - Listening: audio player + questions
- Continue/Complete module buttons

**State 3 — Exam Complete:**
- Summary with per-module scores and overall band

**State:**
```typescript
exam: FullExamSession | null
runtimeState: ExamRuntimeState | null
currentModuleIndex: number              // 0-3 (speaking, writing, reading, listening)
moduleAnswers: Record<IELTSModule, any>
loading: boolean
error: string
```

**API Calls:**
- `webApi.startFullExam()` — Initialize new exam
- `GET /exams/{id}/continue` — Resume exam
- `POST /exams/{id}/module/{module}/start` — Start module section
- `POST /exams/{id}/module/{module}/submit` with responses — Submit module
- `POST /exams/{id}/complete` — Complete exam
- `GET /exams/{id}` → FullExamSession

**Modals:**
1. **Resume Exam Confirmation** — `ModalConfirm`: "You have an exam in progress. Resume or start new?"
2. **Exit Exam Confirmation** — `ModalConfirm`: "Are you sure you want to leave? Progress will be saved."
3. **Exam Completion Summary** — displays all module scores

**Local Storage:** Saves exam resume state for crash recovery.

**Module Order:** speaking (0) → writing (1) → reading (2) → listening (3)

---

## 7. History Detail Pages

### 7.1 Speaking Session Detail

**Route:** `/app/speaking/history/[sessionId]`

**Purpose:** View detailed feedback for a completed speaking practice session.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ [← Back to Speaking]  Session: {sessionId}           │
├──────────────────────┬───────────────────────────────┤
│ Transcript Panel     │ Band Insights Panel           │
│ - Question text      │ - Overall Band (large KPI)    │
│ - User response text │ - 2x2 metric grid:            │
│                      │   Fluency | Lexical Resource  │
│                      │   Grammar | Pronunciation     │
│                      │ - Summary paragraph            │
│                      │ - Strengths list               │
│                      │ - Improvements list            │
└──────────────────────┴───────────────────────────────┘
```

**API Call:** `webApi.getPracticeSessionDetail(sessionId)` → `GET /practice/sessions/{sessionId}`

**Data Shape — `SpeakingSessionDetail`:**
```typescript
{
  topicTitle: string
  question: string
  userResponse: string
  status: string
  completedAt: string | null
  feedback?: {
    overallBand: number | null
    bandBreakdown?: { fluency, lexicalResource, grammaticalRange, pronunciation: number }
    summary: string
    strengths: string[]
    improvements: string[]
  }
}
```

---

### 7.2 Writing Submission Detail

**Route:** `/app/writing/history/[submissionId]`

**Purpose:** View AI evaluation of a writing submission.

**UI:** Header + back button → `/app/progress`. Panel shows: overall band, feedback summary, breakdown (taskResponse, coherenceCohesion, lexicalResource, grammaticalRangeAccuracy), inline suggestions list.

**API Call:** `GET /writing/submissions/{submissionId}` → `WritingSubmission`

---

### 7.3 Reading Attempt Detail

**Route:** `/app/reading/history/[attemptId]`

**Purpose:** Review reading test results and per-question correctness.

**UI:** Header + back button → `/app/progress`. Panel shows: band score, score (correct/total), feedback summary, answers list with ✓/✗ indicators.

**API Call:** `GET /reading/tests/{attemptId}` → `ObjectiveAttempt`

---

### 7.4 Listening Attempt Detail

**Route:** `/app/listening/history/[attemptId]`

**Purpose:** Review listening test results. Identical layout to Reading Attempt Detail.

**API Call:** `GET /listening/tests/{attemptId}` → `ObjectiveAttempt`

---

## 8. Library Pages

### 8.1 Library Explorer (Shared Component)

**Used by:** `/app/library/vocabulary`, `/app/library/collocations`, `/app/library/books`, `/app/library/channels`

**Component:** `LibraryExplorerPage` with prop `kind: 'collocations' | 'vocabulary' | 'books' | 'channels'`

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: gradient (violet to indigo), "Learner Library"│
├──────────────────────────────────────────────────────┤
│ Tab Nav: [Collocations] [Vocabulary] [Books] [Chan.] │
├──────────────────────────────────────────────────────┤
│ Filters:                                             │
│ [Search...] [Topic...] [Module ▼] [CEFR ▼] [Diff ▼] │
│ [Apply Filters]               Showing X of Y entries │
├──────────────────────────────────────────────────────┤
│ Deck Creation:                                       │
│ [Deck name...] [Select Top 8] [Clear] [Save Deck(n)]│
├──────────────────────────────────────────────────────┤
│ Items Grid (2 columns):                              │
│ ┌──────────────────┐ ┌──────────────────┐           │
│ │ ☐ Title          │ │ ☐ Title          │           │
│ │   Subtitle/def   │ │   Subtitle/def   │           │
│ │   module|cefr|dif│ │   module|cefr|dif│           │
│ └──────────────────┘ └──────────────────┘           │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
items: LibraryItem[]
total: number
loading: boolean
error: string
search: string
topic: string
module: string                  // '' | 'speaking' | 'writing' | 'reading' | 'listening'
cefr: string                    // '' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
difficulty: string              // '' | 'beginner' | 'intermediate' | 'advanced'
selected: string[]              // Selected item IDs for deck
deckName: string
deckStatus: string
creatingDeck: boolean
```

**API Calls (based on `kind`):**
- `webApi.listCollocations(query)` → `GET /library/collocations`
- `webApi.listVocabulary(query)` → `GET /library/vocabulary`
- `webApi.listBooks(query)` → `GET /library/resources/books`
- `webApi.listChannels(query)` → `GET /library/resources/channels`
- `webApi.createLibraryDeck({ name, entryType, entryIds })` → `POST /library/decks`

**Item Card Content (varies by kind):**
- Collocations: phrase, meaning, examples, alternatives
- Vocabulary: lemma, definition, synonyms, examples
- Books/Channels: title, description, provider, URL, sponsored badge

---

## 9. Gamification Pages

### 9.1 Achievements Page

**Route:** `/app/achievements`

**Purpose:** Display all achievements with unlock status and progress tracking.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: "Achievements"                               │
├──────────┬──────────┬────────────────────────────────┤
│ Unlocked │ Points   │ Completion %                   │
│ X / Y    │ (violet) │ (with progress bar)            │
├──────────┴──────────┴────────────────────────────────┤
│ Category Filters (10 pills):                         │
│ [All] [Practice] [Improvement] [Streak] [Social]     │
│ [Milestone] [Speed] [Consistency] [Mastery] [Season] │
├──────────────────────────────────────────────────────┤
│ Unlocked Achievements (3-col grid):                  │
│ Each card: icon, tier badge, points, name, desc,     │
│            unlock date                               │
├──────────────────────────────────────────────────────┤
│ In Progress (3-col grid):                            │
│ Each card: same + progress bar (current/target %)    │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
achievements: AchievementWithProgress[]
loading: boolean
error: string
category: AchievementCategory | 'all'
```

**API Call:** `webApi.getAchievementProgress()` → `GET /achievements/progress`

**Tier Colors:** bronze=orange, silver=gray, gold=yellow, platinum=cyan, diamond=violet

---

### 9.2 Leaderboard Page

**Route:** `/app/leaderboard`

**Purpose:** Global and friends leaderboard with period and metric filtering.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: "Leaderboard"                                │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Your Rank│ Score    │ Total    │ Percentile          │
│ (violet) │          │ Users    │                     │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Tabs: [Global] [Friends]                             │
│ Period: [This Week] [This Month] [All Time]          │
│ Metric: [Score] [Practices] [Achievements] [Streak]  │
├──────────────────────────────────────────────────────┤
│ Ranked List:                                         │
│ 🥇 1. Username  sessions:X badges:Y streak:Z  Score │
│ 🥈 2. Username  ...                            Score │
│ 🥉 3. Username  ...                            Score │
│    4. Username  ...                            Score │
│ ► 15. You (highlighted)                        Score │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
entries: LeaderboardEntry[]
position: LeaderboardPosition | null
loading: boolean
error: string
period: 'weekly' | 'monthly' | 'all-time'
metric: 'score' | 'practices' | 'achievements' | 'streak'
tab: 'global' | 'friends'
optingIn: boolean
```

**API Calls:**
- `webApi.getLeaderboard({ period, metric, limit: 50 })` → `GET /leaderboard`
- `webApi.getFriendsLeaderboard({ period, metric })` → `GET /leaderboard/friends`
- `webApi.getMyLeaderboardPosition({ period, metric })` → `GET /leaderboard/position`
- `webApi.leaderboardOptIn()` → `POST /leaderboard/opt-in`

**Conditional Rendering:**
- Opted in → show position card + leaderboard
- Not opted in → show opt-in CTA card
- Medal emojis for top 3 ranks
- Current user row highlighted with "(You)" label

---

### 9.3 Rewards Page

**Route:** `/app/rewards`

**Purpose:** Points balance, discount redemption, earning methods, and transaction history.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: "Points & Rewards"                           │
├──────────┬──────────┬────────────────────────────────┤
│ Balance  │ Earned   │ Redeemed                       │
│ (violet  │ (emerald)│                                │
│ gradient)│          │                                │
├──────────┴──────────┴────────────────────────────────┤
│ Next Tier Progress: X% discount → progress bar       │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Bronze 5%│Silver 10%│ Gold 15% │ Platinum 20%        │
│ X pts    │ X pts    │ X pts    │ X pts               │
│ [Redeem] │ [Redeem] │ [Redeem] │ [Redeem]            │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Success Banner: "Your code: XXXX" + link to billing  │
├──────────────────────────────────────────────────────┤
│ How to Earn (3-col grid): Practice, Streaks, Achieve │
├──────────────────────────────────────────────────────┤
│ Transaction History Table:                           │
│ Icon+Type | Reason | Amount (+/-) | Balance | Date   │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
summary: PointsSummary | null
transactions: PointsTransaction[]
loading: boolean
error: string
redeeming: DiscountTier | null    // Currently redeeming tier
redeemSuccess: string             // Success message with coupon code
```

**API Calls:**
- `webApi.getPointsSummary()` → `GET /points/summary`
- `webApi.getPointsTransactions(30)` → `GET /points/transactions?limit=30`
- `webApi.redeemPoints(tier)` → `POST /points/redeem` with `{ discountTier: '5%'|'10%'|'15%'|'20%' }`

---

## 10. Account & Billing Pages

### 10.1 Billing Page

**Route:** `/app/billing`

**Purpose:** Subscription management, plan selection, checkout, and billing portal.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Gradient Header with status badges:                  │
│ [Billing] [Stripe Connected/Not] [Mode] [Plan]      │
├──────────────────────────────────────────────────────┤
│ Current Usage Card:                                  │
│ Plan badge + usage badges per module                 │
│ [Manage Billing] button (if Stripe portal enabled)   │
├──────────────────────────────────────────────────────┤
│ Billing Cycle: [Monthly] [Annual]                    │
├──────────────────────────────────────────────────────┤
│ Optional: [Coupon code...] [Partner code...]         │
├──────────┬──────────┬────────────────────────────────┤
│ Plan 1   │ Plan 2   │ Plan 3                         │
│ Name     │ Name ★   │ Name                           │
│ $X/mo    │ $X/mo    │ $X/mo                          │
│ Features │ Features │ Features                       │
│ Limits   │ Limits   │ Limits                         │
│ [Choose] │ [Choose] │ [Choose]                       │
└──────────┴──────────┴────────────────────────────────┘
```

**State:**
```typescript
plans: SubscriptionPlanCatalogEntry[]
summary: UsageSummary | null
currentSubscription: CurrentSubscription | null
stripeConfig: StripeConfiguration | null
billingCycle: 'monthly' | 'annual'
checkoutCouponCode: string
checkoutPartnerCode: string
loadingPlan: string | null
openingPortal: boolean
error: string
success: string
checkoutState: string | null     // From ?state= query param ('success'|'cancel')
```

**API Calls:**
- `GET /subscription/plans` → plan catalog
- `GET /usage/summary` → usage stats
- `GET /subscription/current` → current subscription
- `GET /subscription/config` → Stripe configuration
- `POST /subscription/checkout` with `{ priceId, billingCycle, couponCode?, partnerCode?, successUrl, cancelUrl }` → `{ checkoutUrl }` (redirects to Stripe)
- `POST /subscription/portal` → `{ portalUrl }` (redirects to Stripe billing portal)
- After checkout success: calls `refreshAppConfig()` to update entitlements

---

### 10.2 Settings Page

**Route:** `/app/settings`

**Purpose:** Account info, notification preferences, study defaults, and push notification management.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Gradient Header: "Account Settings"                  │
├──────────────────────┬───────────────────────────────┤
│ Account Info (left)  │ Study Defaults (right)        │
│ - Email, name, plan  │ - Track: [Academic|General]   │
│ - Admin roles        │ - Target band: [input]        │
│ - Browser Push:      │                               │
│   Status indicator   │                               │
│   [Enable]/[Disable] │                               │
├──────────────────────┴───────────────────────────────┤
│ Notification Toggles (2-column grid):                │
│ ○ Direct messages      ○ Group messages              │
│ ○ Friend requests      ○ Friend acceptances          │
│ ○ System announcements ○ Special offers              │
│ ○ Partner offers       ○ Inactivity reminders        │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
settings: NotificationSettings          // All boolean toggles
preferredTrack: 'academic' | 'general'  // UI only (not saved to API yet)
targetBand: string                      // UI only
loading: boolean
saving: boolean
error: string
success: string
supportsPush: boolean
permissionState: 'default' | 'denied' | 'granted' | 'unsupported'
hasRegisteredWebPush: boolean
```

**API Calls:**
- `GET /notifications/preferences` → NotificationSettings
- `PUT /notifications/preferences` with updated settings
- `POST /notifications/device/web` → register web push endpoint
- `DELETE /notifications/device/web` → unregister web push endpoint

**NotificationSettings fields (all boolean):**
```
dailyReminderEnabled, dailyReminderHour, dailyReminderMinute,
achievementsEnabled, streakRemindersEnabled, inactivityRemindersEnabled,
feedbackNotificationsEnabled, directMessagesEnabled, groupMessagesEnabled,
friendRequestsEnabled, friendAcceptancesEnabled, systemAnnouncementsEnabled,
offersEnabled, partnerOffersEnabled
```

---

### 10.3 Partner Page

**Route:** `/app/partner`

**Purpose:** Partner program dashboard (for active partners) or application form (for non-partners).

**Conditional States:**

**State A — Feature Disabled:** Simple message asking admin to enable.

**State B — Active Partner Dashboard:**
```
┌──────────────────────────────────────────────────────┐
│ Hero: "Partner Program" - Earnings Dashboard         │
├──────────┬──────────┬────────────────────────────────┤
│ Lifetime │ Total    │ Unpaid Queue                   │
│ Conv+Rev │ Earnings │ + Pending Items                │
├──────────┴──────────┴────────────────────────────────┤
│ Current Month: Date range + conversions/revenue/comm │
├──────────────────────────────────────────────────────┤
│ Active Codes Table: Code | Mode | Commission | Valid │
└──────────────────────────────────────────────────────┘
```

**State C — Application Form:**
```
Partner type dropdown (Influencer|Institute)
Display name input (required)
Legal name input (optional)
Contact email input (optional)
Notes textarea (optional)
[Submit Application]
```

**State D — Pending Review:** Message showing application is pending.

**State:**
```typescript
partnerSelf: PartnerSelfResponse | null
dashboard: PartnerDashboard | null
loading: boolean
submitting: boolean
error: string
success: string
partnerType: 'influencer' | 'institute'
displayName: string
legalName: string
contactEmail: string
notes: string
```

**API Calls:**
- `GET /partners/me` → PartnerSelfResponse (determines which state to show)
- `GET /partners/dashboard` → PartnerDashboard (if partner)
- `POST /partners/applications` with form data (if applying)

---

## 11. Admin Pages

### 11.1 Admin Overview

**Route:** `/admin/overview`

**Purpose:** High-level platform health dashboard with KPIs, latency, flags, alerts, and deployments.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: "Dashboard / Overview" + [System Normal] badge│
│ Time window: [1h] [24h] [7d]                        │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Active   │ Weekly   │ AI Cost  │ Platform Health     │
│ Users    │ Revenue  │ (Est.)   │ %                   │
│ (delta%) │ (delta%) │ (delta%) │ (delta%)            │
├──────────┴──────────┴──────────┴─────────────────────┤
│ AI Endpoint Latency Chart      │ Feature Flags (top 4)│
│ (SVG line chart)               │ key: on/off + rollout│
│                                │ [Manage Flags →]     │
├────────────────────────────────┴─────────────────────┤
│ Recent Alerts & Logs (6)       │ Deployments (top 3)  │
│ Severity | Action | When       │ Name | Status        │
│ [Details] button each          │ [View Logs][Rollback]│
└────────────────────────────────┴─────────────────────┘
```

**State:**
```typescript
windowFilter: '1h' | '24h' | '7d'
view: AdminOverviewView | null
loading: boolean
error: string
notice: string
selectedAlert: object | null          // For alert details modal
rollbackModalOpen: boolean
rollbackBusy: boolean
```

**API Call:**
- `webApi.getAdminOverviewView({ window })` → `GET /admin/overview-view`

**Modals:**
1. **Alert Details Modal** — `ModalConfirm` showing alert severity, action, target, timestamp, and JSON details
2. **Growth Rollback Modal** — `ModalConfirm` confirming disabling of 5 growth feature flags. Lists flags being disabled. Calls `PATCH /admin/feature-flags/{flag}` for each flag.

---

### 11.2 Admin Analytics

**Route:** `/admin/analytics`

**Purpose:** Detailed platform analytics with revenue, traffic, AI costs, funnel, cohorts, and partner performance.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header + [7d|30d|90d] range + [Export CSV] [Export JSON]│
├──────────┬──────────┬──────────┬─────────────────────┤
│ Revenue  │ Active   │ Avg Token│ Gross Margin        │
│ $X       │ Users    │ Cost     │ %                   │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Traffic & Submissions Line Chart (SVG dual polyline) │
├──────────────────────────────────────────────────────┤
│ AI Expenditure (donut chart + breakdown by module)   │
├──────────────────────────────────────────────────────┤
│ Conversion Funnel (visit → register → practice → paid → retained)│
├──────────────────────────────────────────────────────┤
│ Cohort Slices: by plan | by module | by channel      │
├──────────────────────────────────────────────────────┤
│ Partner Performance Table (top 8)                    │
│ Name | Touches | Conversions | Conv% | Revenue       │
├──────────────────────────────────────────────────────┤
│ API Health: Module bars with success rate %          │
└──────────────────────────────────────────────────────┘
```

**API Calls:**
- `webApi.getAdminAnalyticsView({ range })` → `GET /admin/analytics-view`
- `webApi.exportAdminAnalyticsView({ range, format })` → raw Response for download

---

### 11.3 AI Cost Page

**Route:** `/admin/ai-cost`

**Note:** Re-exports the same AdminAnalyticsPage component — shows identical view.

---

### 11.4 Admin Users Page

**Route:** `/admin/users`

**Purpose:** User directory with role management and audit log viewer.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Gradient Header: "Role Management and Audit Logs"    │
├──────────────────────────────────────────────────────┤
│ Users Section:                                       │
│ [Search email/name...] [Search]                      │
│ Email | Name | Plan (badge) | Roles (checkboxes) | ✓ │
│  Roles: ☐ superadmin ☐ content_manager ☐ support     │
├──────────────────────────────────────────────────────┤
│ Audit Logs Section:                                  │
│ [Action filter] [Date from] [Date to] [Search]      │
│ Actor | Action | Target | When                       │
└──────────────────────────────────────────────────────┘
```

**State:**
```typescript
payload: { users: AdminUserRecord[], total, limit, offset } | null
roleDrafts: Record<string, AdminRole[]>     // Pending role changes per user
auditPayload: AdminAuditLogPage | null
userQuery: string
auditActionFilter: string
dateFrom: string
dateTo: string
error: string
success: string
loadingUserId: string
loadingUsers: boolean
```

**API Calls:**
- `GET /admin/users?limit=50&offset=0&query={q}` → user list
- `PATCH /admin/users/{userId}/roles` with `{ roles: AdminRole[] }` → update roles
- `GET /admin/audit-logs?limit=50&offset=0&action={a}&dateFrom={d}&dateTo={d}` → audit logs

---

### 11.5 Admin Subscriptions Page

**Route:** `/admin/subscriptions`

**Purpose:** Manage user subscriptions — activate, cancel, change plans, log refund notes.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Gradient Header: "Admin Subscriptions"               │
├──────────────────────────────────────────────────────┤
│ [Search...] [Search]                                 │
│ ID | User | Plan | Status (badge) | Renewal | Actions│
│ Actions: [Activate/Resume] [Cancel] [Log Refund]    │
│ Plan: [dropdown ▼] [Change Plan]                     │
└──────────────────────────────────────────────────────┘
```

**Modal — Refund Note:**
- Textarea for refund note
- Confirm/Cancel buttons
- Calls `webApi.logAdminSubscriptionRefundNote(subscriptionId, { note })`

**API Calls:**
- `webApi.listAdminSubscriptions({ limit, offset, query })` → subscription list
- `webApi.updateAdminSubscriptionStatus(id, { status })` → activate/cancel
- `webApi.updateAdminSubscriptionPlan(id, { planType })` → change plan
- `webApi.logAdminSubscriptionRefundNote(id, { note })` → log refund

---

### 11.6 Admin Feature Flags Page

**Route:** `/admin/flags`

**Purpose:** Manage feature flags with safety confirmation for high-impact flags.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Gradient Header: "Feature Flags with Safety Gates"   │
├──────────────────────────────────────────────────────┤
│ Flag | Status | Rollout % [input] | Desc | Safety | ⚡│
├──────────────────────────────────────────────────────┤
│ HIGH-IMPACT CONFIRMATION (amber alert):              │
│ "Type 'CONFIRM {flag}' to proceed"                   │
│ [text input]  [Confirm] [Cancel]                     │
└──────────────────────────────────────────────────────┘
```

**High-Impact Flags:** Any flag key containing 'speaking', 'billing', 'auth', 'admin', or 'full_exam' requires typed confirmation to toggle.

**API Calls:**
- `GET /admin/feature-flags` → FeatureFlag[]
- `PATCH /admin/feature-flags/{key}` with `{ enabled, rolloutPercentage, description }`

---

### 11.7 Admin Content Page

**Route:** `/admin/content`

**Purpose:** CRUD for writing tasks, reading tests, and listening tests.

**UI Elements:**
- Module selector (writing/reading/listening) + target ID input
- **Module-specific forms:**
  - Writing: track, taskType, title, prompt, instructions (textarea), minWords, suggestedTime
  - Reading: track, title, passageTitle, passageText (textarea), questions JSON
  - Listening: track, title, sectionTitle, transcript (textarea), audioUrl, questions JSON
- Load Content, Create, Update buttons
- Existing records table: ID | Title | Track | [Edit]

**API Calls:**
- `GET /admin/content/{module}?limit=30` → existing records
- `POST /admin/content` with `{ module, payload }` → create
- `PATCH /admin/content/{module}/{id}` with `{ module, payload }` → update

---

### 11.8 Admin Blog Page

**Route:** `/admin/content/blog`
**Component:** `AdminBlogManagerPage`

**Purpose:** Blog content pipeline management (idea → draft → QA → review → publish).

**UI Sections:**
1. **Generate Ideas:** cluster input + count → `POST /admin/blog/generate-ideas`
2. **Create Draft:** title, cluster, risk level, markdown body, auto-publish checkbox → `POST /admin/blog/drafts`
3. **SEO Health:** metrics display + refresh queue controls → `GET /admin/seo/content-health`, `POST /admin/seo/refresh-queue`
4. **Posts List:** filtered by cluster/state. Each post shows:
   - Title, metadata, state badge, QA badge
   - Review notes textarea
   - Action buttons: Approve, Request Changes, Reject, Publish (only if QA passed)

---

### 11.9 Admin Notifications Page

**Route:** `/admin/notifications`

**Purpose:** Create and manage push notification campaigns.

**UI Layout (2-column):**
- **Left: Create Campaign Form:**
  - Title, body (textarea), type (system/offer), mode (immediate/scheduled)
  - Scheduled datetime (if scheduled)
  - Audience selector: all_users, all_partner_owners, partner_owners_by_type, partner_owners_by_ids, partner_attributed_users, partner_owners_and_attributed
  - Conditional fields: partner type dropdown, partner IDs input
  - Fallback immediate checkbox
  - [Run Preflight] [Create Campaign]
  - Preflight results box: targeted users, frequency cap, link validation, schedule readiness, warnings

- **Right: Campaigns List:**
  - Table: Title (link) | Type | Status | [Send Now] [Cancel]
  - Campaign detail panel (when selected): info + delivery records table (20 max)

**API Calls:**
- `GET /admin/notifications/campaigns?limit=100` → campaigns list
- `GET /admin/notifications/campaigns/{id}` → campaign detail + deliveries
- `POST /admin/notifications/campaigns` → create campaign
- `POST /admin/notifications/campaigns/preflight` → preflight checks
- `POST /admin/notifications/campaigns/{id}/send-now` → send immediately
- `PATCH /admin/notifications/campaigns/{id}/cancel` → cancel campaign

---

### 11.10 Admin Ads Page

**Route:** `/admin/ads`
**Component:** `AdminAdsManagerPage`

**Purpose:** Advertising operations — create packages, manage campaigns, view analytics.

**UI Sections:**
1. **Analytics Dashboard (4 cards):** campaigns count, advertisers count, CTR%, estimated MRR
2. **Create Package Form:** key, name, description, placementType (5 options), billingType (4 options), price
3. **Create Campaign Form:** name, packageId, CTA URL, targeting hint
4. **Campaigns List:** name, placement, package, status badge, impressions/clicks, status update buttons (8 statuses)

**API Calls:**
- `webApi.getAdAnalytics()` → `GET /admin/ads/analytics`
- `webApi.listAdCampaigns({ limit, offset })` → `GET /admin/ads/campaigns`
- `webApi.createAdPackage(payload)` → `POST /admin/ads/packages`
- `webApi.createAdCampaign(payload)` → `POST /admin/ads/campaigns`
- `webApi.updateAdCampaignStatus(id, { status })` → `PATCH /admin/ads/campaigns/{id}/status`

---

### 11.11 Admin Partners Page

**Route:** `/admin/partners`

**Purpose:** Partner payout operations — view commissions, preview batches, process payouts.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header + [Export Report] [Process Batch]             │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Pending  │ Next     │ Total    │ Rows in Scope       │
│ Payouts  │ Batch    │ Paid LTM │                     │
├──────────┴──────────┴──────────┴─────────────────────┤
│ Status filter [▼]  Sort [▼]                          │
│ Commissions Table:                                   │
│ Partner | Revenue | Rate | Payout | Method | Status  │
│ [Include/Exclude] toggle per row                     │
└──────────────────────────────────────────────────────┘
```

**Payout Batch Modal (`ModalConfirm`):**
- Partner count, total payout, processing fee cards
- Flagged accounts table (if any) with risk factors
- Top payouts summary: top earner, most referrals, avg commission
- Confirmation checkbox + [Confirm & Execute]

**API Calls:**
- `webApi.getAdminPayoutOperationsView({ status, sort, limit, offset })` → payout operations
- `webApi.previewPayoutBatch({ periodStart, periodEnd, partnerIds })` → batch preview
- `POST /admin/partners/payout-batches` with batch data → execute batch
- `webApi.getPayoutBatchDetail(batchId)` → batch detail

---

## 12. Layout Shells

### 12.1 Marketing Shell

**Component:** `MarketingShell` — wraps all `/(marketing)` routes

**Header (sticky):**
- Logo/brand link → `/`
- Navigation links: Home, Guides (`/ielts`), Blog (`/blog`), Advertise, Features, Pricing, Methodology, About, Contact
- Theme toggle (light/dark)
- Auth-aware buttons:
  - Authenticated → "Open App" button → `/app/dashboard`
  - Not authenticated → "Login" + "Start Free" → `/login`, `/register`

**Footer:** Standard marketing footer

---

### 12.2 Learner Shell

**Component:** `LearnerShell` — wraps all `/(learner)/app` routes

**Fixed Sidebar (264px width):**
```
┌─────────────────────┐
│ Logo/Brand          │
├─────────────────────┤
│ Dashboard           │
├─────────────────────┤
│ PRACTICE AREAS      │
│  Speaking           │
│  Writing *          │
│  Reading *          │
│  Listening *        │
├─────────────────────┤
│ ASSESSMENT          │
│  Full Exams *       │
│  Progress & Stats   │
│  Study Plan         │
├─────────────────────┤
│ LIBRARY             │
│  Collocations       │
│  Vocabulary         │
│  Books              │
│  Channels           │
├─────────────────────┤
│ REWARDS             │
│  Achievements       │
│  Leaderboard        │
│  Points & Rewards   │
├─────────────────────┤
│ ACCOUNT             │
│  Billing & Plan     │
│  Settings           │
│  Partner Portal **  │
├─────────────────────┤
│ User: name, email   │
│ [Logout]            │
└─────────────────────┘

* = Conditionally shown based on feature flags
** = Only shown if user is a partner
```

**Feature Flag Gating:**
- Writing: `appConfig.featureFlags.writing_module.enabled`
- Reading: `appConfig.featureFlags.reading_module.enabled`
- Listening: `appConfig.featureFlags.listening_module.enabled`
- Full Exams: `appConfig.featureFlags.full_exam_module.enabled`
- Partner Portal: `appConfig.partnerPortal.isPartner`

---

### 12.3 Admin Shell

**Component:** `AdminShell` — wraps all `/(admin)/admin` routes

**Header:**
- Admin logo: "Spokio Admin"
- Search bar with smart routing:
  - Route matching (case-insensitive label/slug)
  - Subscription keywords → `/admin/subscriptions?query={q}`
  - Email-like or 24-char ObjectId → `/admin/users?query={q}`
  - Fallback → `/admin/users?query={q}`
- Navigation links (role-gated):
  - **Operations:** Overview, Content*, Blog Ops*, Users†, Subscriptions†, Campaigns‡, Partners‡, Ads‡
  - **Intelligence:** Analytics*, AI Cost*, Flags‡
  - `*` = superadmin | content_manager
  - `†` = superadmin | support_agent
  - `‡` = superadmin only
- Link to Learner App
- Notification bell with alert feed (top 10 from last 24h, from `getAdminOverviewView({window:'24h'})`)
- User initials button with logout

---

## 13. Complete API Reference

### Authentication
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /auth/login | `{ email, password }` | `AuthResult` |
| POST | /auth/register | `{ email, firstName, lastName, password, phone?, referralCode?, partnerCode? }` | `AuthResult` |
| POST | /auth/logout | — | void |
| POST | /auth/refresh | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | /auth/forgot-password | `{ email }` | void |
| POST | /auth/reset-password | `{ token, password }` | void |
| POST | /auth/verify-email | `{ token }` | void |

### App Configuration
| Method | Path | Response |
|--------|------|----------|
| GET | /app/config | `AppConfig` |
| GET | /app/dashboard-view | `LearnerDashboardView` |
| GET | /app/progress-view?range=&module= | `LearnerProgressView` |
| GET | /app/insights/strength-map?range= | `StrengthMapView` |
| GET | /app/insights/improvement-plan?module= | `ImprovementPlanView` |

### Speaking Module
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /topics/practice?category=&search=&limit=&offset= | — | `PracticeTopicPage` |
| POST | /speaking/practice/start | `{ topicId }` | `PracticeSessionStartPayload` |
| POST | /speaking/practice/{id}/submit | `{ response, durationSeconds }` | `PracticeSession` |
| POST | /speaking/simulation/start | — | `SimulationStartPayload` |
| POST | /speaking/simulation/{id}/submit | `{ responses, timeSpent }` | `SimulationSession` |
| POST | /speaking/quick/evaluate | `{ response }` | `SpeakingEvaluation` |
| GET | /practice/sessions/{id} | — | `SpeakingSessionDetail` |

### Writing Module
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /writing/tasks/generate | `{ track, taskType }` | `WritingTask` |
| POST | /writing/submissions | `{ taskId, track, taskType, response, durationSeconds }` | `WritingSubmission` |
| GET | /writing/submissions/{id} | — | `WritingSubmission` |
| GET | /writing/history?track=&taskType=&limit= | — | `WritingSubmission[]` |

### Reading Module
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /reading/tests/start | `{ track }` | `{ attemptId, ...ObjectiveTestPayload }` |
| POST | /reading/tests/{id}/submit | `{ answers: [{questionId, answer}] }` | `ObjectiveAttempt` |
| GET | /reading/tests/{id} | — | `ObjectiveAttempt` |
| GET | /reading/history?track=&limit= | — | `ObjectiveAttempt[]` |

### Listening Module
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /listening/tests/start | `{ track }` | `{ attemptId, audioUrl?, transcript?, ...ObjectiveTestPayload }` |
| POST | /listening/tests/{id}/submit | `{ answers }` | `ObjectiveAttempt` |
| GET | /listening/tests/{id} | — | `ObjectiveAttempt` |
| GET | /listening/history?track=&limit= | — | `ObjectiveAttempt[]` |

### Full Exams
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /exams/full/start | — | `FullExamSession` |
| GET | /exams/full/{id}/runtime | — | `ExamRuntimeState` |
| POST | /exams/full/{id}/pause | `{ currentModule?, currentQuestionIndex?, remainingSecondsByModule?, resumeToken? }` | void |
| POST | /exams/full/{id}/resume | same as pause | void |
| POST | /exams/{id}/module/{module}/start | — | module-specific payload |
| POST | /exams/{id}/module/{module}/submit | module answers | module result |
| POST | /exams/{id}/complete | — | `FullExamSession` |
| GET | /exams/{id} | — | `FullExamSession` |

### Library
| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | /library/collocations | search, topic, module, cefr, difficulty, limit, offset | `LibraryListResponse<CollocationLibraryEntry>` |
| GET | /library/vocabulary | same | `LibraryListResponse<VocabularyLibraryEntry>` |
| GET | /library/resources/books | same | `LibraryListResponse<ResourceLibraryEntry>` |
| GET | /library/resources/channels | same | `LibraryListResponse<ResourceLibraryEntry>` |
| POST | /library/decks | `{ name, entryType, entryIds }` | `LibraryDeckResponse` |
| GET | /library/decks/review-queue?limit= | — | review queue |
| POST | /library/decks/{id}/review-events | `{ entryId, rating, qualityScore? }` | review event |

### Gamification
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /achievements/progress | — | `AchievementWithProgress[]` |
| GET | /leaderboard?period=&metric=&limit= | — | `LeaderboardEntry[]` |
| GET | /leaderboard/friends?period=&metric= | — | `LeaderboardEntry[]` |
| GET | /leaderboard/position?period=&metric= | — | `LeaderboardPosition` |
| POST | /leaderboard/opt-in | — | void |
| POST | /leaderboard/opt-out | — | void |
| GET | /points/summary | — | `PointsSummary` |
| GET | /points/transactions?limit= | — | `PointsTransaction[]` |
| POST | /points/redeem | `{ discountTier }` | `DiscountRedemptionResult` |

### Subscriptions & Billing
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /subscription/plans | — | `{ plans: SubscriptionPlanCatalogEntry[] }` |
| GET | /subscription/current | — | `CurrentSubscription` |
| GET | /subscription/config | — | `StripeConfiguration` |
| GET | /usage/summary | — | `UsageSummary` |
| POST | /subscription/checkout | `{ priceId, billingCycle, couponCode?, partnerCode?, successUrl, cancelUrl }` | `{ checkoutUrl }` |
| POST | /subscription/portal | — | `{ portalUrl }` |

### Notifications
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /notifications/preferences | — | `NotificationSettings` |
| PUT | /notifications/preferences | `NotificationSettings` | void |
| POST | /notifications/device/web | `{ token }` | void |
| DELETE | /notifications/device/web | — | void |

### Partner Program
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /partners/me | — | `PartnerSelfResponse` |
| GET | /partners/dashboard | — | `PartnerDashboard` |
| POST | /partners/applications | `{ partnerType, displayName, legalName?, contactEmail?, notes? }` | void |

### Admin Endpoints
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /admin/overview-view?window= | — | `AdminOverviewView` |
| GET | /admin/analytics-view?range= | — | `AdminAnalyticsView` |
| GET | /admin/analytics-view/export?range=&format= | — | raw Response |
| GET | /admin/users?limit=&offset=&query= | — | `{ users, total, limit, offset }` |
| PATCH | /admin/users/{id}/roles | `{ roles }` | void |
| GET | /admin/audit-logs?limit=&offset=&action=&dateFrom=&dateTo= | — | `AdminAuditLogPage` |
| GET | /admin/subscriptions?... | — | `AdminSubscriptionListResponse` |
| PATCH | /admin/subscriptions/{id}/status | `{ status }` | void |
| PATCH | /admin/subscriptions/{id}/plan | `{ planType }` | void |
| POST | /admin/subscriptions/{id}/refund-note | `{ note }` | void |
| GET | /admin/feature-flags | — | `FeatureFlag[]` |
| PATCH | /admin/feature-flags/{key} | `{ enabled, rolloutPercentage, description }` | void |
| GET | /admin/content/{module}?limit=&offset= | — | content records |
| POST | /admin/content | `{ module, payload }` | void |
| PATCH | /admin/content/{module}/{id} | `{ module, payload }` | void |
| GET | /admin/blog/posts?cluster=&state=&limit=&offset= | — | `BlogPostListResponse` |
| POST | /admin/blog/generate-ideas | `{ cluster?, count }` | `BlogIdeasResponse` |
| POST | /admin/blog/drafts | `{ title, cluster?, contentRisk, body, scheduleAutoPublish }` | `BlogDraftResponse` |
| PATCH | /admin/blog/{id}/review | `{ decision, notes? }` | `BlogPostDetail` |
| POST | /admin/blog/{id}/publish | — | `BlogPostDetail` |
| GET | /admin/seo/content-health | — | `SeoContentHealth` |
| POST | /admin/seo/refresh-queue | `{ cluster?, limit }` | `SeoRefreshQueueResult` |
| GET | /admin/notifications/campaigns?limit=&offset= | — | campaigns list |
| GET | /admin/notifications/campaigns/{id} | — | campaign detail |
| POST | /admin/notifications/campaigns | campaign payload | campaign record |
| POST | /admin/notifications/campaigns/preflight | campaign payload | `CampaignPreflight` |
| POST | /admin/notifications/campaigns/{id}/send-now | — | void |
| PATCH | /admin/notifications/campaigns/{id}/cancel | — | void |
| GET | /admin/ads/analytics | — | `AdAnalyticsView` |
| GET | /admin/ads/campaigns?status=&limit=&offset= | — | `AdCampaignListResponse` |
| POST | /admin/ads/packages | package payload | `AdPackageRecord` |
| POST | /admin/ads/campaigns | campaign payload | `{ campaignId, status }` |
| PATCH | /admin/ads/campaigns/{id}/status | `{ status, notes? }` | `AdCampaignRecord` |
| GET | /admin/partners/payout-operations-view?status=&sort=&limit=&offset= | — | `AdminPayoutOperationsView` |
| POST | /admin/partners/payout-batches/preview | `{ periodStart, periodEnd, partnerIds? }` | `PayoutBatchPreview` |
| POST | /admin/partners/payout-batches | batch payload | batch result |
| GET | /admin/partners/payout-batches/{id} | — | `PayoutBatchDetail` |

### Blog (Public)
| Method | Path | Response |
|--------|------|----------|
| GET | /blog/posts?cluster=&limit=&offset= | `BlogPostListResponse` |
| GET | /blog/posts/{slug} | `BlogPostDetail` |

### Advertiser
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /advertisers/checkout-session | `{ packageId, successUrl, cancelUrl, couponCode? }` | `AdvertiserCheckoutSession` |
| GET | /advertisers/subscription | — | `AdvertiserSubscriptionView` |

---

## 14. Complete Type Reference

All TypeScript types used across the frontend. These are the exact contracts the frontend expects from APIs.

### Enums / Union Types

```typescript
type SubscriptionPlan = 'free' | 'premium' | 'pro' | 'team'
type BillingCycle = 'monthly' | 'annual'
type AdminRole = 'superadmin' | 'content_manager' | 'support_agent'
type IELTSModule = 'speaking' | 'writing' | 'reading' | 'listening'
type IELTSModuleTrack = 'academic' | 'general'
type AchievementCategory = 'practice' | 'improvement' | 'streak' | 'social' | 'milestone' | 'speed' | 'consistency' | 'mastery' | 'seasonal'
type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time'
type LeaderboardMetric = 'score' | 'practices' | 'achievements' | 'streak'
type DiscountTier = '5%' | '10%' | '15%' | '20%'
type BlogPostState = 'idea' | 'outline' | 'draft' | 'qa_passed' | 'pending_review' | 'published' | 'archived'
type BlogContentRisk = 'low_risk_update' | 'pillar' | 'commercial'
type NotificationCampaignType = 'system' | 'offer'
type NotificationCampaignStatus = 'draft' | 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed'
type NotificationCampaignAudienceKind = 'all_users' | 'all_partner_owners' | 'partner_owners_by_type' | 'partner_owners_by_ids' | 'partner_attributed_users' | 'partner_owners_and_attributed'
```

### Core Interfaces

```typescript
interface AuthUser {
  _id: string; email: string; firstName: string; lastName: string;
  subscriptionPlan: SubscriptionPlan; adminRoles?: AdminRole[];
}

interface AuthResult {
  accessToken: string; refreshToken: string; user: AuthUser;
}

interface AppConfig {
  roles: AdminRole[]; subscriptionPlan: SubscriptionPlan;
  usageSummary: UsageSummary;
  enabledFeatureFlags: string[];
  featureFlags: Record<string, { enabled: boolean; rolloutPercentage: number }>;
  partnerPortal?: { isPartner: boolean; status?: string; partnerType?: string; dashboardUrl?: string };
}

interface UsageSummary {
  plan: SubscriptionPlan;
  practiceCount: number; practiceLimit: number;
  testCount: number; testLimit: number;
  writingCount: number; writingLimit: number;
  readingCount: number; readingLimit: number;
  listeningCount: number; listeningLimit: number;
  aiRequestCount: number; aiTokenCount: number; aiEstimatedCostUsd: number;
  lastReset: string;
}

interface FeatureFlag {
  key: string; enabled: boolean; rolloutPercentage: number; description?: string;
}
```

### Writing Types

```typescript
interface WritingTask {
  taskId: string; track: IELTSModuleTrack; taskType: 'task1' | 'task2';
  title: string; prompt: string; instructions: string[];
  suggestedTimeMinutes: number; minimumWords: number; tags: string[];
}

interface WritingSubmission {
  _id: string; taskId?: string; track?: IELTSModuleTrack; taskType?: string;
  overallBand: number; wordCount?: number; durationSeconds?: number;
  breakdown: { taskResponse: number; coherenceCohesion: number; lexicalResource: number; grammaticalRangeAccuracy: number };
  feedback: { summary: string; inlineSuggestions: string[]; strengths: string[]; improvements: string[] };
  createdAt?: string;
}
```

### Objective (Reading/Listening) Types

```typescript
interface ObjectiveQuestion {
  questionId: string; type: string; prompt: string;
  options?: string[]; correctAnswer?: string;
}

interface ObjectiveTestPayload {
  testId: string; title: string; track: IELTSModuleTrack;
  questions: ObjectiveQuestion[]; passageText?: string;
  transcript?: string; audioUrl?: string; suggestedTimeMinutes: number;
}

interface ObjectiveAttempt {
  _id: string; normalizedBand?: number; score?: number; totalQuestions?: number;
  durationSeconds?: number; status?: string;
  feedback?: { summary?: string; strengths?: string[]; improvements?: string[] };
  answers?: Array<{ questionId: string; answer: string; isCorrect?: boolean }>;
  createdAt?: string;
}
```

### Speaking Types

```typescript
interface PracticeTopic {
  _id?: string; slug: string; title: string; description?: string;
  part: number; category?: string; difficulty?: string; isPremium?: boolean;
}

interface PracticeSessionStartPayload {
  sessionId: string; topic: PracticeTopic; question: string;
  timeLimit: number; tips: string[];
}

interface PracticeSession {
  _id?: string; sessionId?: string; topicId: string; topicTitle?: string;
  question: string; part?: number; status: 'in_progress' | 'completed';
  userResponse?: string;
  feedback?: { overallBand?: number; summary?: string; strengths?: string[]; improvements?: string[];
    bandBreakdown?: { pronunciation?: number; fluency?: number; lexicalResource?: number; grammaticalRange?: number } };
  startedAt?: string; completedAt?: string; createdAt?: string;
}

interface SpeakingEvaluation {
  overallBand: number; spokenSummary: string;
  criteria: Record<string, unknown>;
  corrections: Array<Record<string, unknown>>;
  suggestions: Array<string | { suggestion?: string }>;
}

interface SimulationStartPayload {
  simulationId: string;
  parts: Array<{ part: number; topicTitle?: string; question: string; timeLimit?: number; tips?: string[] }>;
}

interface SimulationSession {
  _id?: string; simulationId?: string; status: 'in_progress' | 'completed';
  parts: SimulationPartDefinition[];
  overallBand?: number; overallFeedback?: PracticeSessionFeedback;
  startedAt?: string; completedAt?: string;
}
```

### Full Exam Types

```typescript
interface FullExamSession {
  _id: string; track: IELTSModuleTrack; status: 'in_progress' | 'completed';
  sections: Array<{ module: IELTSModule; status: 'pending'|'in_progress'|'completed'; attemptId?: string; score?: number; submittedAt?: string }>;
  overallBand?: number; startedAt?: string; completedAt?: string;
}

interface ExamRuntimeState {
  examId: string; status: 'in_progress' | 'completed';
  currentModule?: IELTSModule; currentQuestionIndex?: number;
  remainingSecondsByModule?: Partial<Record<IELTSModule, number>>;
  resumeToken?: string; sections: FullExamSection[];
}
```

### Gamification Types

```typescript
interface AchievementWithProgress {
  _id: string; key: string; name: string; description: string;
  category: AchievementCategory; tier?: AchievementTier;
  icon: string; points: number;
  requirement: { type: string; value: number };
  isPremium: boolean; isActive: boolean; order: number;
  userProgress?: { progress: number; isUnlocked: boolean; unlockedAt?: string };
}

interface LeaderboardEntry {
  rank: number; userId: string; username: string; avatar?: string;
  score: number; totalSessions: number; achievements: number; streak: number;
  isCurrentUser: boolean; isFriend?: boolean;
}

interface LeaderboardPosition { rank: number; score: number; totalUsers: number; percentile: number }

interface PointsSummary {
  balance: number; totalEarned: number; totalRedeemed: number;
  currentTier: { tier: DiscountTier; percentage: number; pointsRequired: number } | null;
  nextTier: { tier: DiscountTier; percentage: number; pointsRequired: number; pointsNeeded: number } | null;
  canRedeem: boolean; activeDiscounts: Array<Record<string, unknown>>;
}

interface PointsTransaction {
  _id: string; userId: string; type: string; amount: number;
  balance: number; reason: string; createdAt: string;
}

interface DiscountRedemptionResult {
  couponCode: string; discountPercentage: number;
  pointsRedeemed: number; billingPeriod: string; expiresAt: string;
}
```

### Subscription & Billing Types

```typescript
interface SubscriptionPlanCatalogEntry {
  tier: SubscriptionPlan; name: string; headline: string; description: string;
  audience: string; recommended?: boolean; features: string[];
  pricing: { currency: string; monthly: { amount: number; priceId?: string };
    annual?: { amount: number; priceId?: string; savingsPercent: number } };
  limits: { practiceSessionsPerMonth: number; simulationSessionsPerMonth: number;
    writingSubmissionsPerMonth: number; readingAttemptsPerMonth: number; listeningAttemptsPerMonth: number };
}

interface StripeConfiguration {
  enabled: boolean; mode: 'disabled'|'test'|'live'|'unknown';
  publishableKey?: string; portalEnabled: boolean;
  priceMatrix?: Record<string, { monthly?: string; annual?: string }>;
}
```

### Notification Types

```typescript
interface NotificationSettings {
  dailyReminderEnabled: boolean; dailyReminderHour: number; dailyReminderMinute: number;
  achievementsEnabled: boolean; streakRemindersEnabled: boolean;
  inactivityRemindersEnabled: boolean; feedbackNotificationsEnabled: boolean;
  directMessagesEnabled: boolean; groupMessagesEnabled: boolean;
  friendRequestsEnabled: boolean; friendAcceptancesEnabled: boolean;
  systemAnnouncementsEnabled: boolean; offersEnabled: boolean; partnerOffersEnabled: boolean;
}

interface NotificationCampaignRecord {
  _id: string; title: string; body: string;
  type: NotificationCampaignType; status: NotificationCampaignStatus;
  scheduledAt?: string; sentAt?: string; createdAt: string;
  audience: NotificationCampaignAudience;
  deliverySummary?: { targetedUsers: number; attempts: number; sent: number; failed: number; skipped: number };
}

interface CampaignPreflight {
  audienceEstimate: { targetedUsers: number };
  safety: { frequencyCapOk: boolean; linkValidationOk: boolean; scheduleReady: boolean; warnings: string[] };
}
```

### Partner Types

```typescript
interface PartnerSelfResponse {
  enabled: boolean; isPartner: boolean; status?: string; partnerType?: string;
  partner?: { _id: string; displayName: string; status: string; partnerType: string } | null;
}

interface PartnerDashboard {
  partner: { id: string; partnerType: string; displayName: string; status: string; defaultCommissionRate: number };
  lifetime: { conversions: number; revenueUsd: number; commissionUsd: number; bonusUsd: number; totalEarningsUsd: number };
  thisMonth: { periodStart: string; periodEnd: string; conversions: number; revenueUsd: number; commissionUsd: number };
  payouts: { unpaidUsd: number; paidItems: number; pendingItems: number };
  activeCodes: Array<{ id: string; code: string; attributionOnly: boolean; commissionRateOverride?: number; validUntil?: string }>;
}
```

### Admin View Types

```typescript
interface AdminOverviewView {
  kpis: { activeUsers: number; estimatedRevenueUsd: number; aiCostUsd: number; platformHealthPercent: number };
  kpiDeltas: Record<string, AdminKpiDelta>;
  latencySeries: Array<{ label: string; value: number }>;
  featureFlagSummary: Array<{ key: string; enabled: boolean; rolloutPercentage: number }>;
  alerts: Array<{ id: string; action: string; targetType: string; targetId?: string; createdAt: string; severity: 'critical'|'warning'|'info'; details?: Record<string, unknown> }>;
  deployments: Array<{ id: string; name: string; status: string; createdAt: string }>;
}

interface AdminAnalyticsView {
  kpis: { totalRevenueUsd: number; activeUsersDaily: number; avgTokenCostUsd: number; grossMarginPercent: number };
  kpiDeltas: Record<string, AdminKpiDelta>;
  trafficSeries: Array<{ date: string; activeUsers: number; submissions: number }>;
  aiExpenditure: { totalCostUsd: number; byModule: Array<{ module: string; costUsd: number }> };
  funnel: Array<{ key: string; label: string; count: number; conversionFromPreviousPercent: number }>;
  cohortSlices: { plan: Record<string, number>; modulePreference: Record<string, number>; acquisitionChannel: Record<string, number> };
  partnerPerformance: Array<{ partnerId: string; partnerName: string; touches: number; conversions: number; conversionRatePercent: number; revenueUsd: number }>;
  apiHealth: Array<{ module: string; successRatePercent: number }>;
}

interface AdminKpiDelta { current: number; previous: number; deltaPercent: number; direction: 'up'|'down'|'flat' }

interface AdminPayoutOperationsView {
  summary: { pendingPayoutUsd: number; nextBatchDate: string; totalPaidLtmUsd: number };
  rows: Array<{ partnerId: string; partnerName: string; attributedRevenueUsd: number; commissionRatePercent: number; calculatedPayoutUsd: number; paymentMethod: string; status: string }>;
  total: number; limit: number; offset: number;
}

interface PayoutBatchPreview {
  partnerCount: number;
  totals: { commissionUsd: number; bonusUsd: number; totalUsd: number };
  preflight: { processingFeeUsd: number; flaggedAccounts: Array<{ partnerId: string; partnerName: string; amountUsd: number; status: 'blocked'|'review_required'; riskFactors: string[] }> };
}
```

### Library Types

```typescript
interface CollocationLibraryEntry {
  id: string; phrase: string; meaning: string; module: IELTSModule;
  cefr: 'A2'|'B1'|'B2'|'C1'|'C2'; topic?: string;
  examples: string[]; alternatives: string[];
  difficulty: 'beginner'|'intermediate'|'advanced'; qualityScore: number;
}

interface VocabularyLibraryEntry {
  id: string; lemma: string; definition: string; module: IELTSModule;
  cefr: 'A2'|'B1'|'B2'|'C1'|'C2'; topic?: string;
  synonyms: string[]; examples: string[];
  difficulty: 'beginner'|'intermediate'|'advanced'; qualityScore: number;
}

interface ResourceLibraryEntry {
  id: string; type: 'book'|'channel'; title: string;
  provider?: string; url?: string; description?: string;
  module: IELTSModule|'all'; sponsored: boolean; qualityScore: number;
}

interface LibraryListResponse<T> { items: T[]; total: number; limit: number; offset: number; hasMore: boolean }
```

### Blog & SEO Types

```typescript
interface BlogPostSummary {
  id: string; title: string; slug: string; excerpt?: string;
  cluster: string; tags: string[]; state: BlogPostState;
  contentRisk: BlogContentRisk; qaPassed: boolean; qaScore?: number;
  publishedAt?: string; lastReviewedAt?: string; createdAt?: string; updatedAt?: string;
}

interface BlogPostDetail extends BlogPostSummary { body: string; sourceLinks: string[] }

interface BlogPostListResponse { posts: BlogPostSummary[]; total: number; limit: number; offset: number; hasMore: boolean }

interface SeoContentHealth {
  totals: { totalPosts: number; publishedPosts: number; pendingReviewPosts: number; failedQaPosts: number; schemaFailures: number; brokenLinkPosts: number; queuedJobs: number };
  clusters: Array<{ key: string; name: string; refreshCadenceDays: number; publishedCount: number; staleCount: number }>;
}
```

### Ad Types

```typescript
interface AdPackageRecord {
  id: string; key: string; name: string; description: string;
  placementType: 'homepage_sponsor'|'module_panel'|'blog_block'|'newsletter_slot'|'partner_spotlight';
  billingType: 'monthly_subscription'|'quarterly_subscription'|'annual_subscription'|'one_time';
  priceAmount: number; currency: string; features: string[]; isActive: boolean;
}

interface AdCampaignRecord {
  id: string; name: string;
  status: 'draft'|'pending_review'|'approved'|'scheduled'|'active'|'paused'|'completed'|'rejected';
  placementType: string; package: AdPackageRecord | null;
  advertiser: { id: string; displayName: string; contactEmail: string; status: string } | null;
  metrics: { impressions: number; clicks: number; conversions: number };
  createdAt: string; updatedAt: string;
}

interface AdAnalyticsView {
  totals: { campaignCount: number; advertiserCount: number; impressions: number; clicks: number; conversions: number; ctrPercent: number; estimatedMonthlyRevenueUsd: number };
  topCampaigns: Array<{ id: string; name: string; status: string; placementType: string; metrics: { impressions: number; clicks: number; conversions: number }; ctr: number }>;
}
```

---

## Validation Rules

```typescript
// Login: email required + valid format, password required
// Register: firstName min 2, lastName min 2, email valid, password 8-128 chars with lowercase+uppercase+digit+special
// Forgot Password: email required + valid format
// Reset Password: same as register password + confirmPassword must match
// Email regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Password strength: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/
```

---

*End of specification. This document covers every page, modal, layout shell, API endpoint, TypeScript type, and state variable in the Spokio IELTS application frontend.*
