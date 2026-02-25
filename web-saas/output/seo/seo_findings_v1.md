# SEO Technical Audit

Generated: 2026-02-22T15:19:47.867805Z
Base URL: http://127.0.0.1:3060/

## Summary

- Pages scanned: 9
- Total findings: 2
- P0: 1 | P1: 0 | P2: 1

## Findings

| ID | Severity | Category | Affected URLs | Impact |
| --- | --- | --- | ---: | --- |
| SEO-001 | P0 | indexability | 4 | Noindex directives can suppress ranking-critical pages. |
| SEO-002 | P2 | structured-data | 4 | Missing structured data can reduce eligibility for rich search enhancements. |

### SEO-001 - indexability (P0)

- Impact: Noindex directives can suppress ranking-critical pages.
- Recommended fix: Remove unintended `noindex` directives from meta robots or X-Robots-Tag headers.
- Verification: Inspect page source and response headers; confirm no `noindex` directive remains.
- Example affected URLs:
  - http://127.0.0.1:3060/admin/overview
  - http://127.0.0.1:3060/app/dashboard
  - http://127.0.0.1:3060/login
  - http://127.0.0.1:3060/register

### SEO-002 - structured-data (P2)

- Impact: Missing structured data can reduce eligibility for rich search enhancements.
- Recommended fix: Add JSON-LD schema matching page type and business entity details.
- Verification: Validate presence of application/ld+json scripts on affected pages.
- Example affected URLs:
  - http://127.0.0.1:3060/about
  - http://127.0.0.1:3060/contact
  - http://127.0.0.1:3060/features
  - http://127.0.0.1:3060/pricing
