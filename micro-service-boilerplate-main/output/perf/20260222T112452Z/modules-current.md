# Load Test Summary

- Generated at: `2026-02-22T11:25:15.023260+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 199.63 | 217.20 | 217.62 | 4.89 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 198.96 | 203.40 | 203.91 | 10.00 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 0.00 | 992.06 | 1269.11 | 1367.02 | 0.95 | - |
| reading-start | sweep | sweep | 2 | count | 8 | 0.00 | 1167.68 | 1359.17 | 1418.27 | 1.65 | - |
| reading-start | sweep | sweep | 4 | count | 8 | 0.00 | 1022.45 | 1346.71 | 1382.34 | 3.01 | - |
| listening-start | sweep | sweep | 1 | count | 8 | 0.00 | 1027.94 | 2072.77 | 2091.06 | 0.77 | - |
| listening-start | sweep | sweep | 2 | count | 8 | 0.00 | 1036.96 | 1236.93 | 1290.18 | 1.82 | - |
| listening-start | sweep | sweep | 4 | count | 8 | 0.00 | 1348.59 | 1881.76 | 1975.58 | 2.32 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
