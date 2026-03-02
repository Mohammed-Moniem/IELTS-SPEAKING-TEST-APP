# Load Test Summary

- Generated at: `2026-02-22T03:23:10.620979+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 227.19 | 509.14 | 626.34 | 3.63 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 226.14 | 303.19 | 303.52 | 8.34 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 87.50 | 747.58 | 1679.18 | 2030.86 | 1.10 | http_403 (7) |
| reading-start | sweep | sweep | 2 | count | 8 | 100.00 | 788.04 | 2428.80 | 2831.63 | 1.70 | http_403 (8) |
| reading-start | sweep | sweep | 4 | count | 8 | 100.00 | 688.92 | 699.49 | 700.03 | 5.79 | http_403 (8) |
| listening-start | sweep | sweep | 1 | count | 8 | 87.50 | 682.67 | 1322.61 | 1571.51 | 1.38 | http_403 (7) |
| listening-start | sweep | sweep | 2 | count | 8 | 100.00 | 723.11 | 2286.84 | 2314.14 | 1.74 | http_403 (8) |
| listening-start | sweep | sweep | 4 | count | 8 | 100.00 | 634.87 | 725.72 | 728.28 | 5.95 | http_403 (8) |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
