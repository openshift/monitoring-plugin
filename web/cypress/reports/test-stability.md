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
| _No data yet — run `/cypress:test-iteration:iterate-incident-tests` or `/cypress:test-iteration:iterate-ci-flaky` to populate_ | | | | | |

## Run History

### Run Log

| # | Date | Type | Branch | Tests | Passed | Failed | Flaky | Commit |
|---|------|------|--------|-------|--------|--------|-------|--------|
| _No runs recorded yet_ | | | | | | | | |

<!-- STABILITY_DATA_START
This section is machine-readable. Do not edit manually.

{
  "tests": {},
  "runs": []
}

STABILITY_DATA_END -->
