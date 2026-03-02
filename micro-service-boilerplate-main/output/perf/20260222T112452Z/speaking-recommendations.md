# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T11:24:52.923515+00:00`
- Target p95: `2500 ms`
- Target error rate: `2.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| speaking-practice-history | 4 | 205.5 | 0.00 | 16.54 | Pass |
| speaking-simulation-history | 4 | 201.3 | 0.00 | 16.65 | Pass |
| speaking-topics-practice | 4 | 2019.8 | 0.00 | 4.12 | Pass |

## Findings

- [P1] `speaking-topics-practice` c=4: Large p95/p50 gap suggests queueing, lock contention, or burst saturation.
- [P1] `speaking-practice-history` c=2: Large p95/p50 gap suggests queueing, lock contention, or burst saturation.

## Prioritized Actions

1. Cap in-process concurrency and add bounded queues to avoid overload collapse.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
