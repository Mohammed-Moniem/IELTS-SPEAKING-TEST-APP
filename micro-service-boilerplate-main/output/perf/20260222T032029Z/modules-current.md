# Load Test Summary

- Generated at: `2026-02-22T03:21:36.463035+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 239.76 | 533.17 | 605.83 | 3.40 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 238.60 | 274.45 | 274.81 | 8.14 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 87.50 | 723.13 | 1946.63 | 1949.84 | 0.99 | http_403 (7) |
| reading-start | sweep | sweep | 2 | count | 8 | 100.00 | 730.53 | 1123.56 | 1124.23 | 2.46 | http_403 (8) |
| reading-start | sweep | sweep | 4 | count | 8 | 100.00 | 826.21 | 2648.87 | 2650.43 | 3.02 | http_403 (8) |
| listening-start | sweep | sweep | 1 | count | 8 | 87.50 | 531.18 | 1334.59 | 1669.06 | 1.48 | http_403 (7) |
| listening-start | sweep | sweep | 2 | count | 8 | 100.00 | 424.97 | 623.33 | 683.62 | 4.12 | http_403 (8) |
| listening-start | sweep | sweep | 4 | count | 8 | 100.00 | 942.06 | 1351.65 | 1353.79 | 3.66 | http_403 (8) |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
