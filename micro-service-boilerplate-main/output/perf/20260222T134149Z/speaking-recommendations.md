# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T13:41:49.988203+00:00`
- Target p95: `2500 ms`
- Target error rate: `2.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| speaking-practice-history | 4 | 214.4 | 0.00 | 16.30 | Pass |
| speaking-simulation-history | 4 | 209.9 | 0.00 | 16.27 | Pass |
| speaking-topics-practice | 4 | 2001.1 | 0.00 | 4.15 | Pass |

## Findings

- [P1] `speaking-topics-practice` c=4: Large p95/p50 gap suggests queueing, lock contention, or burst saturation.

## Prioritized Actions

1. Cap in-process concurrency and add bounded queues to avoid overload collapse.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
