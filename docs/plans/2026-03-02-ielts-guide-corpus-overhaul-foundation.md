# IELTS Guide Corpus Overhaul Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship wave-1 technical foundation for hierarchical `/ielts/*` guides with backend Guide CMS endpoints, public/admin contracts, legacy URL compatibility, and dynamic sitemap plumbing.

**Architecture:** Add a dedicated Guide domain in the backend (models + service + public/admin controllers) parallel to existing blog growth APIs. Replace flat frontend guide detail routing with hierarchical catch-all resolution that prefers backend content and gracefully falls back to existing static guide data while legacy slugs 301 redirect to canonical paths.

**Tech Stack:** Next.js App Router (TypeScript), routing-controllers + typedi backend, mongooseCompat document store, class-validator DTOs.

---

### Task 1: Backend Guide Domain Models and Table Mapping

**Files:**
- Create: `micro-service-boilerplate-main/src/api/models/GuidePageModel.ts`
- Create: `micro-service-boilerplate-main/src/api/models/GuideSourceMapModel.ts`
- Create: `micro-service-boilerplate-main/src/api/models/GuideQaReportModel.ts`
- Create: `micro-service-boilerplate-main/src/api/models/GuideImportJobModel.ts`
- Create: `micro-service-boilerplate-main/src/api/models/GuideTaxonomyNodeModel.ts`
- Modify: `micro-service-boilerplate-main/src/lib/db/tableMappings.ts`

**Steps:**
1. Add schemas/interfaces for guide pages, source mapping, QA reports, import jobs, taxonomy nodes.
2. Include fields required by plan: hierarchy, classification, governance, QA metrics, provenance, SEO metadata.
3. Register all guide models in table mappings.

### Task 2: Backend DTOs and Service

**Files:**
- Modify: `micro-service-boilerplate-main/src/api/dto/GrowthDto.ts`
- Create: `micro-service-boilerplate-main/src/api/services/GuideService.ts`

**Steps:**
1. Add validated query/body DTOs for public and admin guide endpoints.
2. Implement GuideService public methods: tree, page-by-path, related, search.
3. Implement GuideService admin methods: sitemap import, list pages/jobs, outline generation, update, review, publish, refresh queue.
4. Enforce core QA publish gates in service publish path.

### Task 3: Backend Controllers and Public Auth Rules

**Files:**
- Create: `micro-service-boilerplate-main/src/api/controllers/GuideController.ts`
- Create: `micro-service-boilerplate-main/src/api/controllers/AdminGuideController.ts`
- Modify: `micro-service-boilerplate-main/src/api/middlewares/AuthMiddleware.ts`

**Steps:**
1. Expose `/guides/*` public endpoints.
2. Expose `/admin/guides/*` admin endpoints with role checks + audit logging.
3. Add `/guides` to auth middleware public patterns.

### Task 4: Frontend Types and API Client

**Files:**
- Modify: `web-saas/src/lib/types/index.ts`
- Modify: `web-saas/src/lib/api/client.ts`

**Steps:**
1. Add Guide CMS response/types contracts for tree, page detail, search, admin flows.
2. Add `webApi` methods for all new public/admin guide endpoints.

### Task 5: Frontend Hierarchical Routing + Legacy Redirects

**Files:**
- Create: `web-saas/src/lib/seo/guideRoutes.ts`
- Create: `web-saas/src/lib/seo/guideData.ts`
- Create: `web-saas/app/(marketing)/ielts/[...segments]/page.tsx`
- Delete: `web-saas/app/(marketing)/ielts/[slug]/page.tsx`
- Modify: `web-saas/app/(marketing)/ielts/page.tsx`

**Steps:**
1. Add canonical path mapping helpers and legacy slug redirect mapping.
2. Add server-side guide data resolver that prefers backend API and falls back to static guide corpus.
3. Implement catch-all `/ielts/[...segments]` detail page with canonical metadata, structured data, and required practice-first blocks.
4. Keep `/ielts` hub functional with backend tree + fallback static cards.

### Task 6: Dynamic Sitemap Integration

**Files:**
- Modify: `web-saas/app/sitemap.ts`

**Steps:**
1. Fetch published guide paths from public guides API where available.
2. Fallback to static guide routes when API unavailable.
3. Preserve existing static marketing routes.

### Task 7: Verification

**Files:**
- Create: `micro-service-boilerplate-main/test/unit/src/guide-routing.test.ts`

**Steps:**
1. Add unit tests for canonical/legacy path helpers.
2. Run backend tests: `npm test -- --testPathPattern=guide-routing.test.ts --config=./jest.config.json`.
3. Run backend typecheck/build check: `npm run build` (or `npx tsc --noEmit` where faster).
4. Run frontend typecheck: `npm run typecheck`.
