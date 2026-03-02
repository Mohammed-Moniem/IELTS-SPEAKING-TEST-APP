# Spokio Web App Overhaul — Gap Analysis

> **Scope**: Replace current `web-saas` UI with the 36 static HTML designs in `app-overhaul/`.
> This document maps every current page against the new designs, identifies backend gaps, and proposes an implementation plan.

---

## 1. Frame & Echo — Current Understanding

- **Goal**: Completely replace every visible UI surface in `web-saas` (learner, admin, and potentially marketing pages) with the Tailwind-utility-only designs from `app-overhaul/`, preserving all existing functionality and API integrations already wired.
- **Stack stays the same**: Next.js 15, React 19, Tailwind CSS. The backend (`micro-service-boilerplate-main`) remains untouched *unless* the new designs demand data the current API doesn't return.
- **Design-first, not feature-first**: The HTML files are the source of truth for layout, color, spacing, typography, and component structure. Any current features not reflected in the designs should still be preserved but styled to match.

---

## 2. Design System Delta

| Token | Current (`globals.css` CSS vars) | New Designs (Tailwind config) | Action |
|---|---|---|---|
| **Primary color** | `--clr-primary` (blue-ish) | `#7C3AED` (Violet-600) — learner pages<br>`#6366F1` (Indigo-600) — admin pages | Replace. Define in `tailwind.config.ts` `extend.colors` |
| **Primary hover** | N/A inline | `#6D28D9` / `#4F46E5` | Add |
| **Font — display** | Plus Jakarta Sans | Plus Jakarta Sans / Inter | Keep Jakarta Sans, add Inter as secondary |
| **Font — body** | Manrope | (none specified, defaults to display) | Drop Manrope, unify on Plus Jakarta Sans |
| **Icons** | Material Icons Round + Symbols Outlined | Material Symbols Outlined (weight/fill variant) | Consolidate to Symbols Outlined |
| **Background** | Radial gradient via CSS vars | `#F3F4F6` (gray-100) flat / `#0F1115` dark | Replace gradient with flat bg |
| **Surface** | `.panel` class with box-shadow, border | Pure white `#FFFFFF` + `border border-border-light rounded-xl` | Replace |
| **Border radius** | `--radius: 8px` | `12px` default, `16px` xl, `24px` 2xl | Update config |
| **Dark mode** | CSS vars with `[data-theme="dark"]` | `class`-based dark: prefix on elements | Migrate to Tailwind `darkMode: 'class'` |
| **Layout system** | `.app-shell` CSS Grid, `.stack`, `.grid-3` | `flex`, `grid`, explicit Tailwind utilities | Replace custom classes |

### CSS Cleanup Required
All of these custom CSS classes in `globals.css` will be removed and replaced by direct Tailwind utilities:
`.panel`, `.stack`, `.kpi`, `.btn`, `.btn-primary`, `.btn-ghost`, `.grid-3`, `.grid-4`, `.pill`, `.tag`, `.hero-panel`, `.section-wrap`, `.st2-*` classes.

---

## 3. Layout Architecture Delta

### 3A. Learner Layout

| Aspect | Current (`LearnerShell.tsx`) | New Design (Dashboard HTML) | Gap |
|---|---|---|---|
| **Structure** | `.app-shell` CSS Grid: sidebar(240px) + main | `flex` based: fixed sidebar(264px) + scrollable main | Rewrite shell to flex layout |
| **Sidebar width** | 240px | 264px | Update |
| **Nav grouping** | Flat list: training links + account links | Grouped sections: "Practice Areas" (Speaking/Writing/Reading/Listening) + "Assessment" (Full Exams/Progress & Stats) | Restructure nav data |
| **Nav icons** | Custom SVG paths in `navIcons` record | Material Symbols Outlined (`record_voice_over`, `edit_note`, `auto_stories`, `headphones`, `quiz`, `monitoring`) | Replace SVGs with icon font |
| **Active state** | `data-active` attribute + CSS | `bg-violet-50 text-violet-700` / dark: `bg-violet-500/10 text-violet-400` | Tailwind classes |
| **User profile** | Not visible in sidebar | Footer of sidebar: avatar + name + email + chevron | Add profile section |
| **Top bar** | Title + action buttons | Not present in dashboard design (content starts at top) | Remove top bar |
| **ThemeToggle** | Present | Not shown in dashboard, but dark mode is supported | Keep but relocate |
| **Feature flags** | `visibleTrainingLinks` filtered by `appConfig.featureFlags` | Not in HTML | Preserve logic, apply to new nav |
| **Partner portal link** | Present for partner users | Not in HTML | Preserve |

### 3B. Speaking/Writing Pages Layout Discrepancy

**Critical finding**: The speaking topics and writing workspace designs use a **top navbar** layout instead of a sidebar. This is **inconsistent** with the dashboard design which uses a sidebar.

| Design File | Layout |
|---|---|
| `spokio_learner_dashboard_1` | Fixed left sidebar |
| `speaking_practice_topics_1` | Horizontal top navbar |
| `writing_practice_workspace_1` | Horizontal top navbar |
| `partner_payout_operations_hub` | Horizontal top navbar (admin) |

**Decision needed**: Use sidebar consistently (like dashboard) for all learner pages, or switch layouts per-page.

### 3C. Admin Layout

| Aspect | Current (`AdminShell.tsx`) | New Design (Payout Ops HTML) | Gap |
|---|---|---|---|
| **Structure** | Sidebar with admin links | Top navbar with horizontal links | Complete layout change |
| **Primary color** | Same as learner | `#6366F1` (Indigo) instead of `#7C3AED` | Different theme for admin |
| **Nav items** | Overview, Content, Users, Subscriptions, Analytics, AI Cost, Flags | Dashboard, Partners, Payouts, Settings | Different nav structure (simpler) |
| **Search** | Not present | Search bar in header | Add search |
| **Notifications** | Not present | Bell icon with badge | Add notification UI |
| **Breadcrumbs** | Not present | Full breadcrumb trail | Add breadcrumbs |

---

## 4. Page-by-Page Gap Analysis

### 4A. Learner Pages

#### Dashboard (`/app/dashboard`)
| Component | Current | New Design | Backend Gap |
|---|---|---|---|
| KPI cards | 4 cards: band, streak, tests, goal | 4 cards: band score, study streak, tests completed, next goal | **None** — `LearnerDashboardView.kpis` already returns all 4 |
| Quick practice | Grid of module cards (emoji icons) | Featured card (Speaking, gradient bg) + 3 regular cards | **None** — `quickPractice` array exists. Frontend needs to feature first item |
| Recent activity | Table with module/title/status/score/date | Identical structure in new design | **None** — `activity` array exists |
| Resume practice | Not visible in current | Right sidebar card with progress bar | **None** — `resume` field already exists in API |
| Recommendations | List of recommended topics | Sidebar list with difficulty badges | **None** — `recommended` array exists |
| Go Premium upsell | Not present | Gradient card with CTA | **None** — `plan` field available to check tier |
| User greeting | "Welcome back" with name | Same pattern | **None** |

**Status: Frontend-only rewrite. No backend changes needed.**

#### Speaking (`/app/speaking`)
| Component | Current (~860 lines) | New Design | Backend Gap |
|---|---|---|---|
| Tab system | Practice / Simulation / Quick Evaluate | Topic grid with filter pills (All / Part 1 / Part 2 / Part 3) | **Redesign** — collapse tabs into filtered grid |
| Topic cards | Inline list within tab panels | 3-column card grid with part badge, difficulty indicator, premium badge | Frontend rewrite |
| Difficulty indicator | Not shown | Color-coded dots (Easy/Medium/Hard) | **Backend may need to add** `difficulty` field to topics endpoint |
| Premium badge | Not shown | Lock icon on premium-only topics | **Backend may need** `isPremium` field |
| Streak counter | Not shown | Header shows "🔥 7 Day Streak" | **None** — available from dashboard KPIs |
| Search | Not present | Search input in header | Frontend addition |
| Practice session UI | Full session workflow within same page | Likely separate page/modal (not in this design file) | Preserve existing |

**Status: Major frontend rewrite. Possible minor backend addition (difficulty, isPremium on topics).**

#### Writing (`/app/writing`)
| Component | Current | New Design | Backend Gap |
|---|---|---|---|
| Layout | Single-page form/list | Split-pane: left (task prompt + chart + tips) / right (editor) | Major layout change |
| Task prompt | Generated inline | Left panel with formatted prompt + embedded chart visualization | Frontend |
| Text editor | Basic textarea | Rich text toolbar (Bold, Italic, Lists, Headings, etc.) | Frontend (consider tiptap/lexical) |
| Word count | Not present | Footer: "142 / 150 min. words" with progress indicator | Frontend |
| Timer | Not present | Footer countdown timer | Frontend |
| Save Draft | Not present | "Save Draft" button | **Backend**: Need `PATCH /writing/drafts/:id` endpoint |
| Submit | Present | "Submit for AI Evaluation" button | **None** — exists |
| Tips panel | Not present | Collapsible tips section in left panel | Frontend |

**Status: Major frontend rewrite. One new backend endpoint for drafts.**

#### Reading (`/app/reading`)
| Current | Expected (no specific design file read yet) | Notes |
|---|---|---|
| Objective test flow | Likely similar topic-grid pattern | Need to read reading design HTML |

#### Listening (`/app/listening`)
| Current | Expected | Notes |
|---|---|---|
| Objective test flow | Likely similar pattern | Need to read listening design HTML |

#### Full Exams (`/app/tests`)
| Component | Current (~757 lines) | Design: `exam_resume_activation_gate` | Backend Gap |
|---|---|---|---|
| Exam orchestration | Full flow: start → sections → complete | Activation/resume gate suggests a pre-exam screen | Need to read HTML |
| Pause/Resume | Already implemented | `pauseExam()`, `resumeExam()` in API | **None** |
| Runtime state | `getExamRuntime()` API exists | Likely consumed | **None** |

#### Progress (`/app/progress`)
| Component | Current | Expected | Backend Gap |
|---|---|---|---|
| Range filter | 7d / 30d / 90d | Likely similar | **None** |
| Module filter | all / speaking / writing / reading / listening | Likely similar | **None** |
| Trend chart | SVG polyline from `view.trend` | New design style | Frontend |
| Skill breakdown | Present | Present | **None** |
| Attempts list | Table format | New card/table format | Frontend |

**Status: Frontend restyling. No backend changes.**

#### Billing (`/app/billing`)
| Component | Current | Expected | Backend Gap |
|---|---|---|---|
| Plan display | Shows current plan + available plans | Redesigned UI | Frontend |
| Usage summary | API call to `/usage/summary` | Present | **None** |

#### Settings (`/app/settings`)
| Component | Current | Expected | Backend Gap |
|---|---|---|---|
| Profile section | Present | Redesigned | Frontend |
| Notifications | Present | Redesigned | Frontend |
| Track/Band prefs | Present | Redesigned | Frontend |

### 4B. Admin Pages

#### Payout Operations (NEW — `/admin/payouts`)
| Component | New Design | Backend Gap |
|---|---|---|
| KPI cards | Pending Payouts $, Next Batch Date, Total Paid LTM | **Exists**: `getAdminPayoutOperationsView()` |
| Commissions table | Partner name, revenue, commission rate, payout, payment method, status | **Exists**: `AdminPayoutOperationsView` type |
| Filters | Status (All/Pending/Processing/Paid), Sort by Amount/Date/Partner | **Exists**: params on API |
| Pagination | Previous/Next with count | **Exists**: limit/offset params |
| Bulk actions | Checkboxes + "Process Batch" button | `previewPayoutBatch()` API exists |
| Export | "Export Report" button | **May need** new endpoint or generate client-side CSV |

#### Payout Batch Confirmation Modal
| Component | New Design | Backend Gap |
|---|---|---|
| Modal overlay | Confirmation dialog before processing batch | Frontend component |
| Batch details | Period, partner count, total amount | `PayoutBatchPreview` type exists |

**Status: Frontend build. Backend API already fully supports this.**

#### Admin Overview, Analytics, Content, Users, Subscriptions, AI Cost, Flags
- Design files for these were not provided in the `app-overhaul/` folder (only payout-related admin designs exist).
- **Decision needed**: Apply new design system to existing admin pages without specific mockups, or leave as-is.

---

## 5. Backend API Gap Summary

| Gap | Severity | Details |
|---|---|---|
| **Topic difficulty field** | Low | Speaking topics may need `difficulty: 'easy' \| 'medium' \| 'hard'` field |
| **Topic premium flag** | Low | Topics may need `isPremium: boolean` for gating |
| **Writing draft save** | Medium | Need `PATCH /writing/drafts/:id` or `POST /writing/drafts` endpoint |
| **Export report endpoint** | Low | Admin payout export — could be client-side CSV generation |

**Overall**: The backend is already well-built. 90%+ of the data the new designs need is already served by existing endpoints.

---

## 6. Design File Inventory & Mapping

Based on the file names in `app-overhaul/`:

| Design File Pattern | Maps To | Count | Priority |
|---|---|---|---|
| `spokio_learner_dashboard_*` | `/app/dashboard` | ~29 variants | **P0** — Pick canonical, build once |
| `speaking_practice_topics_*` | `/app/speaking` | ~2 | **P0** |
| `writing_practice_workspace_*` | `/app/writing` | ~2 | **P1** |
| `exam_resume_activation_gate_*` | `/app/tests` | ~1 | **P1** |
| `partner_payout_operations_hub_*` | `/admin/payouts` | ~1 | **P2** |
| `payout_batch_confirmation_modal_*` | `/admin/payouts` (modal) | ~1 | **P2** |

---

## 7. Implementation Plan

### Phase 0: Foundation (Design System + Layout Shell) — ~2 days
1. **Update `tailwind.config.ts`**: Add violet/indigo primary colors, new border radius, Inter font, dark mode class strategy
2. **Rewrite `globals.css`**: Strip all custom classes (`.panel`, `.stack`, `.kpi`, etc.), keep only Tailwind base/components/utilities layers + minimal resets
3. **Rewrite `LearnerShell.tsx`**: New flex-based sidebar, grouped nav sections, Material Symbols icons, user profile footer
4. **Rewrite `AdminShell.tsx`**: Top navbar layout, search bar, notification bell, breadcrumb support
5. **Create shared components**: KPI card, data table, filter pills, status badges, pagination

### Phase 1: Learner Dashboard — ~1.5 days
1. Rewrite `/app/dashboard/page.tsx` with new KPI grid, featured practice card, activity table, resume card, recommendations, premium upsell
2. Wire existing `webApi.getLearnerDashboardView()` — no backend changes

### Phase 2: Speaking Practice — ~2 days
1. Rewrite `/app/speaking/page.tsx` — topic grid with filter pills, card layout
2. Preserve practice session workflow (possibly extract to sub-route)
3. Add difficulty/premium indicators (with graceful fallback if backend fields missing)

### Phase 3: Writing Workspace — ~2.5 days
1. Rewrite `/app/writing/page.tsx` — split-pane layout
2. Integrate rich text editor (tiptap recommended)
3. Add word counter, timer, save-draft flow
4. **Backend**: Add draft save endpoint if needed

### Phase 4: Remaining Learner Pages — ~2 days
1. Reading, Listening — apply new card/grid patterns
2. Full Exams — integrate exam_resume_activation_gate design
3. Progress — rewrite with new chart styles
4. Billing, Settings — restyle with new design system

### Phase 5: Admin Pages — ~1.5 days
1. Build Partner Payout Operations page
2. Build Payout Batch Confirmation modal
3. Apply new design system tokens to remaining admin pages (Overview, Content, etc.)

### Phase 6: Polish — ~1 day
1. Dark mode pass on all pages
2. Responsive breakpoints (designs show desktop, need mobile adaptations)
3. Animations/transitions (hover states, page transitions)
4. Accessibility audit (focus rings, aria labels, screen reader)

**Total estimated effort: ~12.5 days**

---

## 8. Open Questions for User

1. **Dashboard variants**: There are ~29 `spokio_learner_dashboard_*` HTML files. Which one is the canonical version to implement? (I've been working from `_1`)
2. **Layout consistency**: Dashboard uses a sidebar, but Speaking/Writing designs use a top navbar. Should we use **sidebar for all learner pages** (matching dashboard) or switch layouts?
3. **Admin scope**: Only payout-related admin designs exist. Should we:
   - (a) Apply the new design system to all existing admin pages, or
   - (b) Only build the payout pages and leave other admin pages as-is?
4. **Admin color**: The admin payout design uses Indigo (`#6366F1`) while learner uses Violet (`#7C3AED`). Is this intentional differentiation?
5. **Marketing pages**: Should the marketing/public pages (homepage, login, etc.) also be overhauled?
6. **Rich text editor**: The writing workspace shows a rich toolbar. Should we integrate a full editor (tiptap/Lexical) or keep it as a plain textarea with markdown?
7. **Dark mode priority**: Should dark mode be part of the initial implementation or a follow-up phase?
