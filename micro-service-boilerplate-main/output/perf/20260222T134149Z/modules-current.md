# Load Test Summary

- Generated at: `2026-02-22T13:42:10.514857+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 198.61 | 209.41 | 210.53 | 4.97 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 197.47 | 201.75 | 203.00 | 10.08 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 87.50 | 418.62 | 1022.82 | 1165.69 | 1.79 | http_403 (7) |
| reading-start | sweep | sweep | 2 | count | 8 | 100.00 | 452.84 | 779.52 | 828.21 | 3.40 | http_403 (8) |
| reading-start | sweep | sweep | 4 | count | 8 | 100.00 | 412.55 | 612.76 | 616.36 | 7.82 | http_403 (8) |
| listening-start | sweep | sweep | 1 | count | 8 | 87.50 | 417.54 | 923.69 | 1140.47 | 1.95 | http_403 (7) |
| listening-start | sweep | sweep | 2 | count | 8 | 100.00 | 407.94 | 545.25 | 599.56 | 4.36 | http_403 (8) |
| listening-start | sweep | sweep | 4 | count | 8 | 100.00 | 433.62 | 920.16 | 1027.87 | 6.22 | http_403 (8) |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
