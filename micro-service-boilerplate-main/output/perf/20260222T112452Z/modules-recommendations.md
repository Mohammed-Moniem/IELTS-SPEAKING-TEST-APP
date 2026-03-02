# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T11:25:15.023260+00:00`
- Target p95: `3500 ms`
- Target error rate: `2.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| listening-start | 4 | 1881.8 | 0.00 | 2.32 | Pass |
| reading-start | 4 | 1346.7 | 0.00 | 3.01 | Pass |
| writing-task-generate | 2 | 203.4 | 0.00 | 10.00 | Pass |

## Findings

- No critical findings. Current results align with the configured targets.

## Prioritized Actions

1. Targets look healthy. Keep the same scenarios as regression checks in CI or nightly runs.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
