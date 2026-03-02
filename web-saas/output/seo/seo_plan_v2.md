# SEO Program Plan

Generated: 2026-02-22T15:26:37.000078Z
Base URL: http://127.0.0.1:3060/
Locale: us-en

## Priorities

| Rank | Step ID | Severity | Type | Owner | Impact |
| ---: | --- | --- | --- | --- | --- |
| 1 | REM-001 | P0 | technical | Engineering | Noindex directives can suppress ranking-critical pages. |
| 2 | REM-002 | P1 | content | Content | Improves intent alignment, CTR, and topical coverage. |
| 3 | REM-003 | P2 | local | Marketing | Improves local relevance for geo-intent queries. |
| 4 | REM-004 | P2 | offpage | Marketing | Improves authority signals for competitive topics. |

## Remediation Steps

### REM-001: Resolve indexability issue (SEO-001)
- Severity: P0
- Type: technical
- Owner: Engineering
- Effort: S
- Action: Remove unintended `noindex` directives from meta robots or X-Robots-Tag headers.
- Verification: Inspect page source and response headers; confirm no `noindex` directive remains.

### REM-002: Run content refresh workflow for strategic pages
- Severity: P1
- Type: content
- Owner: Content
- Effort: M
- Action: Use assets/templates/content-brief.md for each strategic URL and map one primary intent per page.
- Verification: Complete content briefs and confirm title/H1/intent alignment on targeted pages.

### REM-003: Run local SEO audit for location pages
- Severity: P2
- Type: local
- Owner: Marketing
- Effort: M
- Action: Use assets/templates/local-seo-audit.md to validate NAP consistency and LocalBusiness schema coverage.
- Verification: Complete local worksheet and resolve any NAP/schema discrepancies.

### REM-004: Build off-page authority opportunity backlog
- Severity: P2
- Type: offpage
- Owner: Marketing
- Effort: M
- Action: Track opportunities in assets/templates/offpage-opportunities.csv and prioritize by topic fit and expected impact.
- Verification: Populate and review the off-page opportunities tracker.

## i18n Expansion Hooks

- Default execution is `us-en`.
- Add hreflang clusters only when multilingual scope is explicitly requested.
- Validate canonical/hreflang consistency before launch of new locales.
