---
name: analyze-ci-results
description: Analyze OpenShift CI (Prow) test results from a gcsweb URL - identifies infra vs test/code failures and correlates with git commits
parameters:
  - name: ci-url
    description: >
      The gcsweb URL for a CI run. Can be any level of the artifact tree:
      - Job root: https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/test-platform-results/pr-logs/pull/openshift_monitoring-plugin/{PR}/{JOB}/{RUN_ID}/
      - Test artifacts: .../{RUN_ID}/artifacts/e2e-incidents/monitoring-plugin-tests-incidents-ui/
      - Prow UI: https://prow.ci.openshift.org/view/gs/test-platform-results/pr-logs/pull/openshift_monitoring-plugin/{PR}/{JOB}/{RUN_ID}
    required: true
  - name: focus
    description: "Optional: focus analysis on specific test file or area (e.g., 'regression', '01.incidents', 'filtering')"
    required: false
---

# Analyze OpenShift CI Test Results

Fetch, parse, and classify failures from an OpenShift CI (Prow) test run. This skill is designed to be the **first step** in an agentic test iteration workflow — it produces a structured diagnosis that the orchestrator can act on.

## Instructions

### Step 1: Normalize the URL

The user may provide a URL at any level. Normalize it to the **job root**:

```
https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/test-platform-results/pr-logs/pull/openshift_monitoring-plugin/{PR}/{JOB}/{RUN_ID}/
```

If the user provides a Prow UI URL (`prow.ci.openshift.org/view/gs/...`), convert it:
- Replace `https://prow.ci.openshift.org/view/gs/` with `https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/`
- Append trailing `/` if missing

Derive these base paths:
- **Job root**: `{normalized_url}`
- **Test artifacts root**: `{normalized_url}artifacts/e2e-incidents/monitoring-plugin-tests-incidents-ui/`
- **Screenshots root**: `{test_artifacts_root}artifacts/screenshots/`
- **Videos root**: `{test_artifacts_root}artifacts/videos/`

### Step 2: Fetch Job Metadata (parallel)

Fetch these files from the **job root** using WebFetch:

| File | What to extract |
|------|----------------|
| `started.json` | `timestamp`, `pull` (PR number), `repos` (commit SHAs) |
| `finished.json` | `passed` (bool), `result` ("SUCCESS"/"FAILURE"), `revision` (PR HEAD SHA) |
| `prowjob.json` | PR title, PR author, PR branch, base branch, base SHA, PR SHA, job name, cluster, duration |

From `started.json` `repos` field, extract:
- **Base commit**: the SHA after `main:` (before the comma)
- **PR commit**: the SHA after `{PR_NUMBER}:`

Present a summary:
```
CI Run Summary:
  PR:          #{PR_NUMBER} - {PR_TITLE}
  Author:      {AUTHOR}
  Branch:      {PR_BRANCH} -> {BASE_BRANCH}
  PR commit:   {PR_SHA} (short: first 7 chars)
  Base commit: {BASE_SHA} (short: first 7 chars)
  Result:      PASSED / FAILED
  Duration:    {DURATION}
  Job:         {JOB_NAME}
```

### Step 3: Fetch and Parse Test Results

Fetch `{test_artifacts_root}build-log.txt` using WebFetch.

#### Cypress Output Format

The build log contains Cypress console output. Parse these sections:

**Per-spec results block** — appears after each spec file runs:
```
  (Results)

  ┌──────────────────────────────────────────────────────────┐
  │ Tests:        N                                          │
  │ Passing:      N                                          │
  │ Failing:      N                                          │
  │ Pending:      N                                          │
  │ Skipped:      N                                          │
  │ Screenshots:  N                                          │
  │ Video:        true                                       │
  │ Duration:     X minutes, Y seconds                       │
  │ Spec Ran:     {spec-file-name}.cy.ts                     │
  └──────────────────────────────────────────────────────────┘
```

**Final summary table** — appears at the very end:
```
  (Run Finished)

  ┌──────────────────────────────────────────────────────────┐
  │ Spec                    Tests  Passing  Failing  Pending │
  ├──────────────────────────────────────────────────────────┤
  │ ✓ spec-file.cy.ts       5      5        0        0      │
  │ ✗ other-spec.cy.ts      3      1        2        0      │
  └──────────────────────────────────────────────────────────┘
```

**Failure details** — appear inline during test execution:
```
  1) Suite Name
       "before all" hook for "test description":
     ErrorType: error message
       > detailed error
       at stack trace...

  N failing
```

Or for test-level (not hook) failures:
```
  1) Suite Name
       test description:
     AssertionError: Timed out retrying after Nms: Expected to find element: .selector
```

Extract per-spec:
- Spec file name
- Pass/fail/skip counts
- For failures: test name, error type, error message, whether it was in a hook

### Step 4: Fetch Failure Screenshots

For each failing spec, navigate to `{screenshots_root}{spec-file-name}/` and list available screenshots.

**Screenshot naming convention:**
```
{Suite Name} -- {Test Title} -- before all hook (failed).png
{Suite Name} -- {Test Title} (failed).png
```

Fetch each screenshot URL and **read it using the Read tool** (multimodal) to understand the visual state at failure time. Describe what you see:
- What page/view is shown?
- Are there error dialogs, loading spinners, empty states?
- Is the expected UI element visible? If not, what's in its place?
- Are there console errors visible in the browser?

### Step 5: Classify Each Failure

For every failing test, classify it into one of these categories:

#### Infrastructure Failures (not actionable by test code changes)

| Classification | Indicators |
|---------------|------------|
| `INFRA_CLUSTER` | Certificate expired, API server unreachable, node not ready, cluster version mismatch |
| `INFRA_OPERATOR` | COO/CMO installation timeout, operator pod not running, CRD not found |
| `INFRA_PLUGIN` | Plugin deployment unavailable, dynamic plugin chunk loading error, console not accessible |
| `INFRA_AUTH` | Login failed, kubeconfig invalid, RBAC permission denied (for expected operations) |
| `INFRA_CI` | Pod eviction, OOM killed, timeout at infrastructure level (not test timeout) |

**Key signals for infra issues:**
- Errors in `before all` hooks related to cluster setup
- Certificate/TLS errors
- `oc` command failures with connection errors
- Element `.co-clusterserviceversion-install__heading` not found (operator install UI)
- Errors mentioning pod names, namespaces, or k8s resources
- `e is not a function` or similar JS errors from the console application itself (not test code)

#### Test/Code Failures (actionable)

| Classification | Indicators |
|---------------|------------|
| `TEST_BUG` | Wrong selector, incorrect assertion logic, race condition / timing issue, test assumes wrong state |
| `FIXTURE_ISSUE` | Mock data doesn't match expected structure, missing alerts/incidents in fixture, edge case not covered |
| `PAGE_OBJECT_GAP` | Page object method missing, selector outdated, doesn't match current DOM |
| `MOCK_ISSUE` | cy.intercept not matching the actual API call, response shape incorrect, query parameter mismatch |
| `CODE_REGRESSION` | Test was passing before, UI behavior genuinely changed — the source code has a bug |

**Key signals for test/code issues:**
- `AssertionError: Timed out retrying` on application-specific selectors (not infra selectors)
- `Expected X to equal Y` where the assertion logic is wrong
- Failures only in specific test scenarios, not across the board
- Screenshot shows the UI rendered correctly but test expected something different

### Step 6: Correlate with Git Commits

Using the PR commit SHA and base commit SHA from Step 2:

1. **Check local git history**: Run `git log {base_sha}..{pr_sha} --oneline` to see what changed in the PR
2. **Identify relevant changes**: Run `git diff {base_sha}..{pr_sha} --stat` to see which files were modified
3. **For CODE_REGRESSION failures**: Check if the failing component's source code was modified in the PR
4. **For TEST_BUG failures**: Check if the test itself was modified in the PR (new test might have a bug)

Present the correlation:
```
Commit correlation for {test_name}:
  PR modified: src/components/incidents/IncidentChart.tsx (+45, -12)
  Test file:   cypress/e2e/incidents/01.incidents.cy.ts (unchanged)
  Verdict:     CODE_REGRESSION - chart rendering changed but test expectations not updated
```

Or:
```
Commit correlation for {test_name}:
  PR modified: cypress/e2e/incidents/regression/01.reg_filtering.cy.ts (+30, -5)
  Source code: src/components/incidents/ (unchanged)
  Verdict:     TEST_BUG - new test code has incorrect assertion
```

### Step 7: Produce Structured Report

Output a structured report with this format:

```
# CI Analysis Report

## Run: PR #{PR} - {TITLE}
- Commit: {SHORT_SHA} by {AUTHOR}
- Branch: {BRANCH}
- Result: {RESULT}
- Duration: {DURATION}

## Summary
- Total specs: N
- Passed: N
- Failed: N (M infra, K test/code)

## Infrastructure Issues (not actionable via test changes)

### INFRA_CLUSTER: Certificate expired
- Affected: ALL tests (cascade failure)
- Detail: x509 certificate expired at {timestamp}
- Action needed: Cluster certificate renewal (outside test scope)

## Test/Code Issues (actionable)

### TEST_BUG: Selector timeout in filtering test
- Spec: regression/01.reg_filtering.cy.ts
- Test: "should filter incidents by severity"
- Error: Timed out retrying after 80000ms: Expected to find element: [data-test="severity-filter"]
- Screenshot: [description of what screenshot shows]
- Commit correlation: Test file was modified in this PR (+30 lines)
- Suggested fix: Update selector to match current DOM structure

### CODE_REGRESSION: Chart not rendering after component refactor
- Spec: regression/02.reg_ui_charts_comprehensive.cy.ts
- Test: "should display incident bars in chart"
- Error: Expected 5 bars, found 0
- Screenshot: Chart area is empty, no error messages visible
- Commit correlation: src/components/incidents/IncidentChart.tsx was refactored
- Suggested fix: Investigate chart rendering logic in the refactored component

## Flakiness Indicators
- If a test failed with a timing-related error but similar tests in the same suite passed,
  flag it as potentially flaky
- If the error message contains "Timed out retrying" on an element that should exist,
  it may be a race condition rather than a missing element

## Recommendations
- List prioritized next steps
- For infra issues: what needs to happen before tests can run
- For test/code issues: which fixes to attempt first (quick wins vs complex)
- Whether local reproduction is recommended
```

### Step 8: If `focus` parameter is provided

Filter the analysis to only the relevant tests. For example:
- `focus=regression` -> only analyze `regression/*.cy.ts` specs
- `focus=filtering` -> only analyze tests with "filter" in their name
- `focus=01.incidents` -> only analyze `01.incidents.cy.ts`

Still fetch all metadata and provide the full context, but limit detailed diagnosis to the focused area.

## Notes for the Orchestrator

When this skill is used as the first step of `/cypress:test-iteration:iterate-incident-tests`:

1. **If all failures are INFRA_***: Report to user and STOP. No test changes will help.
2. **If mixed INFRA_* and TEST/CODE**: Report infra issues to user, proceed with test/code fixes only.
3. **If all failures are TEST/CODE**: Proceed with the full iteration loop.
4. **The commit correlation** tells the orchestrator whether to focus on fixing tests or investigating source code changes.
5. **Screenshots** give the Diagnosis Agent a head start — it can reference the CI screenshot analysis instead of reproducing the failure locally first.
