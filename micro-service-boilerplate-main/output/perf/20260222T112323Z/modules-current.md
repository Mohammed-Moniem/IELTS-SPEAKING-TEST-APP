# Load Test Summary

- Generated at: `2026-02-22T11:23:47.722343+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 197.10 | 199.74 | 200.22 | 5.06 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 196.86 | 199.31 | 199.36 | 10.11 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 87.50 | 429.70 | 1922.87 | 2144.72 | 1.20 | http_403 (7) |
| reading-start | sweep | sweep | 2 | count | 8 | 100.00 | 409.14 | 912.54 | 1044.78 | 3.50 | http_403 (8) |
| reading-start | sweep | sweep | 4 | count | 8 | 100.00 | 518.43 | 638.79 | 638.95 | 6.44 | http_403 (8) |
| listening-start | sweep | sweep | 1 | count | 8 | 87.50 | 595.61 | 1441.24 | 1490.51 | 1.23 | http_403 (7) |
| listening-start | sweep | sweep | 2 | count | 8 | 100.00 | 409.98 | 795.66 | 796.93 | 3.96 | http_403 (8) |
| listening-start | sweep | sweep | 4 | count | 8 | 100.00 | 408.17 | 596.67 | 600.22 | 8.00 | http_403 (8) |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
