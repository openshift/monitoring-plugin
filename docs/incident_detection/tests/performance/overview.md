# Performance Testing - Incidents Page

Location: `web/cypress/e2e/incidents/performance/`
Verifies: OBSINTA-1006

## Test Suite

### 01. Performance Benchmark (`01.performance_benchmark.cy.ts`)

Measures wall-clock render time for chart operations under escalating data loads. Uses `performance.mark()`/`performance.measure()` for timing.

**What it tests:**
- Incidents chart render: 100, 200, 500 alerts (single incident)
- Alerts detail chart render after incident selection: 100, 200, 500 alerts
- Multi-incident chart: 20 uniform incidents, 12 mixed-size incidents (67 alerts)

**Thresholds** are regression indicators, not absolute targets. They include Cypress overhead (~3-5s per navigation cycle). Calibrate by running 3-5 times on a clean build, then set at ~2x median.

**Known limitation:** 1000-alert tests are disabled — mocking that volume triggers a maximum call stack error in the mock generator, though equivalent non-mocked simulated data renders without issue. To re-enable, apply:

```diff
--- a/web/cypress/e2e/incidents/performance/01.performance_benchmark.cy.ts
+++ b/web/cypress/e2e/incidents/performance/01.performance_benchmark.cy.ts
@@ end of it('6.1 ...')
+    cy.log('6.1.4 Incidents chart with 1000 alerts (single incident)');
+    benchmarkIncidentsChart(
+      '18-stress-test-1000-alerts-single.yaml',
+      1,
+      THRESHOLDS.INCIDENTS_CHART_1000_ALERTS,
+      'Incidents chart - 1000 alerts',
+      '7 days',
+    );

@@ end of it('6.2 ...')
+    cy.log('6.2.4 Alerts chart after selecting incident with 1000 alerts');
+    benchmarkAlertsChart(
+      '18-stress-test-1000-alerts-single.yaml',
+      'cluster-wide-failure-1000-alerts',
+      THRESHOLDS.ALERTS_CHART_1000_ALERTS,
+      'Alerts chart - 1000 alerts',
+      '7 days',
+    );
```

### 02. Interactive Walkthrough (`02.performance_walkthrough.cy.ts`)

Measures incremental re-render cost during a realistic user session (as opposed to 01 which measures initial render).

**What it tests:**
- Filter apply/clear cycle times with 20 incidents loaded
- Time range switching (1d → 3d → 7d → 15d → 1d)
- Table row expansion with 100 and 500 alerts

### 03. Endurance Cycling — Shelved

Rapidly cycles select/deselect across 20 incidents to detect progressive degradation or memory leaks. Compares first-10 vs last-10 cycle averages against a degradation threshold.

**Status:** Shelved — results are unreliable due to Cypress overhead (see below). The full test source is preserved in [`03.endurance_test_source.md`](./03.endurance_test_source.md). To re-enable, copy it to `web/cypress/e2e/incidents/performance/`.

## Cypress Overhead

All timings include Cypress command processing time. This adds a constant baseline to each operation and, more importantly, a **progressive overhead** that grows with test length.

### DOM snapshot accumulation

Cypress captures a full DOM snapshot for every logged command (to enable time-travel debugging in the runner). The OpenShift Console DOM is large (thousands of nodes), so each snapshot is expensive. Over many cycles, these snapshots accumulate in memory, causing:

- Increasing GC pressure → micro-jank on interactions
- Cypress command queue growth → longer per-command scheduling
- Linear slowdown: cycle times grow ~10x over 100 cycles regardless of application performance

### Mitigation attempts and findings

| Approach | Result |
|----------|--------|
| `{ log: false }` on commands | ~20% total time reduction, ~34% faster by cycle 100. Gap widens over time, confirming snapshot accumulation contributes. But `.should()` assertions have no `log` option and still snapshot. |
| `numTestsKeptInMemory: 0` | Only purges between `it()` blocks, not within a single long-running test. |
| Split into multiple `it()` blocks | `testIsolation: false` preserves page state, but fixture/mock setup between blocks adds complexity and the shared state management is fragile. |
| Override `Cypress.log` with no-op | Cypress internally chains `.snapshot()`, `.end()`, `.set()` on the log return value. Stubbing all methods is brittle across Cypress versions. |

### Implication for the endurance test

The endurance test (03) cannot reliably distinguish between "the UI is getting slower" and "Cypress is getting slower." Both logged and unlogged runs show ~9-10x degradation over 100 cycles, dominated by Cypress overhead. The test would only catch catastrophic leaks that add degradation far above the Cypress baseline.

## Potential: In-App Performance Measurement

A more accurate approach would instrument the React components directly:

1. Add `performance.mark()` calls inside the incidents component's render/effect lifecycle
2. Trigger interactions from Cypress but measure only the React work via `cy.window()`
3. The endurance loop would still run in Cypress, but measured duration would exclude Cypress command queue and snapshot overhead

This is not implemented because it requires modifying production source code (or adding test-only hooks), and the benchmark tests (01, 02) already provide sufficient regression signal for practical purposes — their shorter duration keeps Cypress overhead in the flat range (~2-3x) where real application regressions are visible.
