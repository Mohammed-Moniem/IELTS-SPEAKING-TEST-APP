# Load Test Summary

- Generated at: `2026-02-22T13:40:52.690264+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 199.69 | 215.15 | 221.28 | 4.94 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 199.71 | 202.05 | 202.32 | 9.98 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 100.00 | 210.91 | 216.42 | 216.45 | 4.72 | http_404 (8) |
| reading-start | sweep | sweep | 2 | count | 8 | 100.00 | 224.23 | 350.44 | 398.37 | 7.38 | http_404 (8) |
| reading-start | sweep | sweep | 4 | count | 8 | 100.00 | 239.87 | 443.55 | 444.78 | 11.77 | http_404 (8) |
| listening-start | sweep | sweep | 1 | count | 8 | 100.00 | 212.28 | 230.15 | 234.90 | 4.64 | http_404 (8) |
| listening-start | sweep | sweep | 2 | count | 8 | 100.00 | 293.22 | 483.45 | 486.92 | 5.77 | http_404 (8) |
| listening-start | sweep | sweep | 4 | count | 8 | 100.00 | 225.35 | 430.68 | 431.91 | 12.10 | http_404 (8) |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
