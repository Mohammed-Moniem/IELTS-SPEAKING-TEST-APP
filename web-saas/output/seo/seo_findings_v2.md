# SEO Technical Audit

Generated: 2026-02-22T15:26:36.973776Z
Base URL: http://127.0.0.1:3060/

## Summary

- Pages scanned: 18
- Total findings: 1
- P0: 1 | P1: 0 | P2: 0

## Findings

| ID | Severity | Category | Affected URLs | Impact |
| --- | --- | --- | ---: | --- |
| SEO-001 | P0 | indexability | 4 | Noindex directives can suppress ranking-critical pages. |

### SEO-001 - indexability (P0)

- Impact: Noindex directives can suppress ranking-critical pages.
- Recommended fix: Remove unintended `noindex` directives from meta robots or X-Robots-Tag headers.
- Verification: Inspect page source and response headers; confirm no `noindex` directive remains.
- Example affected URLs:
  - http://127.0.0.1:3060/admin/overview
  - http://127.0.0.1:3060/app/dashboard
  - http://127.0.0.1:3060/login
  - http://127.0.0.1:3060/register
