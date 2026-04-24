# Test Stability Ledger

Tracks incident detection test stability across local and CI iteration runs. Updated automatically by `/cypress:test-iteration:iterate-incident-tests` and `/cypress:test-iteration:iterate-ci-flaky`.

## How to Read

- **Pass rate**: percentage across all recorded runs (local + CI combined)
- **Trend**: direction over last 3 runs
- **Last failure**: most recent failure reason and which run it occurred in
- **Fixed by**: commit that resolved the issue (if applicable)

## Current Status

| Test | Pass Rate | Trend | Runs | Last Failure | Fixed By |
|------|-----------|-------|------|-------------|----------|
| BVT: Incidents - 1.1 Toolbar and charts toggle functionality | 100% | stable | 7 | — | — |
| BVT: Incidents - 1.2 Incidents chart renders with bars | 100% | stable | 7 | — | — |
| BVT: Incidents - 1.3 Incidents table renders with rows | 100% | stable | 7 | — | — |
| BVT: Incidents - 1.4 Charts and alerts empty state | 100% | stable | 7 | — | — |
| BVT: Incidents - 1.5 Traverse Incident Table | 100% | stable | 7 | 2026-04-16: plugin tab timeout (80s) | 0cb566d (warmUpForPlugin in goTo + BVT before) |
| Regression: Filtering - 1. Severity filtering | 100% | stable | 7 | — | — |
| Regression: Filtering - 2. Chart interaction with active filters | 100% | stable | 7 | — | — |
| Regression: Charts UI - 2.1 Chart renders with correct bar count | 100% | stable | 7 | — | — |
| Regression: Charts UI - 2.2 Chart bars have correct severity colors | 100% | stable | 7 | — | — |
| Regression: Charts UI - 2.3 Toggle charts button hides/shows chart | 100% | stable | 7 | — | — |
| Regression: Charts UI - 2.4 Incident selection updates alert chart | 100% | stable | 7 | — | — |
| Regression: Silences - 3.1 Silenced alerts not shown as active | 100% | stable | 7 | — | — |
| Regression: Silences - 3.2 Mixed silenced and firing alerts | 100% | stable | 7 | — | — |
| Regression: Redux - 4.1 Redux state updates on filter change | 100% | stable | 7 | — | — |
| Regression: Redux - 4.2 Redux state persists across navigation | 100% | stable | 7 | — | — |
| Regression: Redux - 4.3 Days selector updates redux state | 100% | stable | 7 | — | — |
| Regression: Stress Testing - 5.1 No excessive padding | 100% | stable | 7 | — | — |

## Run History

### Run Log

| # | Date | Type | Cluster | Tests | Passed | Failed | Flaky | Commit |
|---|------|------|---------|-------|--------|--------|-------|--------|
| 1 | 2026-04-16 | local | ci-ln-trfv3nt (cluster 1) | 17 | 17 | 0 | 0 | 567c2e7 |
| 2 | 2026-04-16 | local | ci-ln-trfv3nt (cluster 1) | 17 | 17 | 0 | 0 | 567c2e7 |
| 3 | 2026-04-16 | local | ci-ln-trfv3nt (cluster 1) | 17 | 17 | 0 | 0 | 567c2e7 |
| 4 | 2026-04-16 | e2e-real | ci-ln-trfv3nt (cluster 1) | 1 | 1 | 0 | 0 | 92bba27 |
| 5 | 2026-04-16 | local | ci-ln-zgwt0qt (cluster 2) | 17 | 17 | 0 | 0 | 580dc96 |
| 6 | 2026-04-17 | local | ci-ln-lg6ry1t (cluster 3) | 17 | 17 | 0 | 0 | 580dc96 |
| 7 | 2026-04-17 | local | ci-ln-lg6ry1t (cluster 3) | 17 | 17 | 0 | 0 | d9f37d2 |
| 8 | 2026-04-22 | local | ci-ln-y7v0t92 (cluster 4) | 17 | 17 | 0 | 0 | 0cb566d |

<!-- STABILITY_DATA_START
This section is machine-readable. Do not edit manually.

{
  "tests": {
    "BVT: Incidents - UI 1. Toolbar and charts toggle functionality": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "BVT: Incidents - UI 1.2 Incidents chart renders with bars": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "BVT: Incidents - UI 1.3 Incidents table renders with rows": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "BVT: Incidents - UI 1.4 Charts and alerts empty state": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "BVT: Incidents - UI 1.5 Traverse Incident Table": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": "Timed out retrying after 80000ms: Expected to find element: [data-test=\"incidents-days-select-toggle\"]",
      "last_failure_date": "2026-04-16",
      "fixed_by": "0cb566d"
    },
    "Regression: Incidents Filtering 1. Severity filtering": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Incidents Filtering 2. Chart interaction with active filters": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Charts UI - Comprehensive 2.1 Chart renders with correct bar count": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Charts UI - Comprehensive 2.2 Chart bars have correct severity colors": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Charts UI - Comprehensive 2.3 Toggle charts button hides/shows chart": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Charts UI - Comprehensive 2.4 Incident selection updates alert chart": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Silences Not Applied Correctly 3.1 Silenced alerts not shown as active": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Silences Not Applied Correctly 3.2 Mixed silenced and firing alerts": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Redux State Management 4.1 Redux state updates on filter change": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Redux State Management 4.2 Redux state persists across navigation": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Redux State Management 4.3 Days selector updates redux state": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    },
    "Regression: Stress Testing UI 5.1 No excessive padding": {
      "results": ["pass", "pass", "pass", "pass", "pass", "pass", "pass"],
      "last_failure_reason": null,
      "last_failure_date": null,
      "fixed_by": null
    }
  },
  "runs": [
    { "date": "2026-04-16", "type": "local", "cluster": "ci-ln-trfv3nt", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "567c2e7" },
    { "date": "2026-04-16", "type": "local", "cluster": "ci-ln-trfv3nt", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "567c2e7" },
    { "date": "2026-04-16", "type": "local", "cluster": "ci-ln-trfv3nt", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "567c2e7" },
    { "date": "2026-04-16", "type": "e2e-real", "cluster": "ci-ln-trfv3nt", "total": 1, "passed": 1, "failed": 0, "flaky": 0, "commit": "92bba27" },
    { "date": "2026-04-16", "type": "local", "cluster": "ci-ln-zgwt0qt", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "580dc96" },
    { "date": "2026-04-17", "type": "local", "cluster": "ci-ln-lg6ry1t", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "580dc96" },
    { "date": "2026-04-17", "type": "local", "cluster": "ci-ln-lg6ry1t", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "d9f37d2" },
    { "date": "2026-04-22", "type": "local", "cluster": "ci-ln-y7v0t92", "total": 17, "passed": 17, "failed": 0, "flaky": 0, "commit": "0cb566d" }
  ]
}

STABILITY_DATA_END -->
