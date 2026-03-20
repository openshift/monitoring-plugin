---
name: iterate-incident-tests
description: Autonomously run, diagnose, fix, and verify incident detection Cypress tests with flakiness probing
parameters:
  - name: target
    description: >
      What to test. Options:
      - "all" — all incident tests (excluding @e2e-real)
      - "regression" — only regression/ directory tests
      - a specific spec file path (e.g., "cypress/e2e/incidents/01.incidents.cy.ts")
      - a grep pattern for a specific test (e.g., "should filter by severity")
    required: true
  - name: max-iterations
    description: "Maximum fix-and-retry cycles (default: 3)"
    required: false
  - name: ci-url
    description: "Optional: gcsweb or Prow URL for CI results to use as starting context (triggers /analyze-ci-results first)"
    required: false
  - name: flakiness-runs
    description: "Number of flakiness probe runs (default: 3). Set to 0 to skip flakiness probing"
    required: false
  - name: skip-branch
    description: "If 'true', work on current branch instead of creating a new one (default: false)"
    required: false
---

# Iterate Incident Tests

Autonomous test iteration loop: run tests, diagnose failures, apply fixes, verify, and probe for flakiness.

## Instructions

Execute the following steps in order. This is the main orchestrator — it coordinates sub-agents and manages the iteration loop.

### Step 0: CI Context (optional)

If `ci-url` is provided, run `/analyze-ci-results` first to get CI failure context.

Capture the CI analysis output:
- If **all failures are INFRA_***: Report the infrastructure issues to the user and **STOP**. No test changes will help.
- If **mixed infra + test/code**: Note the infra issues for the user, but proceed with the test/code failures only.
- If **all test/code**: Proceed. Use the CI diagnosis (commit correlation, screenshots) as context for the local iteration.

Store the CI analysis as `ci_context` for later reference by diagnosis agents.

### Step 1: Branch Setup

Unless `skip-branch` is "true":

```bash
cd /home/drajnoha/Code/monitoring-plugin && git checkout -b test/incident-robustness-$(date +%Y-%m-%d) main
```

If the branch already exists, append a suffix: `-2`, `-3`, etc.

### Step 2: Resolve Target

Based on the `target` parameter, determine the Cypress run command:

| Target | Spec | Grep Tags |
|--------|------|-----------|
| `all` | `cypress/e2e/incidents/**/*.cy.ts` | `@incidents --@e2e-real --@flaky --@demo` |
| `regression` | `cypress/e2e/incidents/regression/**/*.cy.ts` | `@incidents --@e2e-real --@flaky` |
| specific file | `cypress/e2e/incidents/{target}` | (none) |
| grep pattern | `cypress/e2e/incidents/**/*.cy.ts` | (none, use `--env grep="{target}"`) |

### Step 3: Clean Previous Results

```bash
cd /home/drajnoha/Code/monitoring-plugin/web && rm -f screenshots/cypress_report_*.json && rm -rf cypress/screenshots/* cypress/videos/*
```

### Step 4: Run Tests

Execute Cypress inline (NOT in a separate terminal):

```bash
cd /home/drajnoha/Code/monitoring-plugin/web && source cypress/export-env.sh && npx cypress run --spec "{SPEC}" {GREP_ARGS}
```

**IMPORTANT**: This command may take several minutes. Use a timeout of 600000ms (10 minutes).

Capture the exit code:
- `0` = all passed
- non-zero = failures occurred

### Step 5: Parse Results

Merge mochawesome reports and parse:

```bash
cd /home/drajnoha/Code/monitoring-plugin/web && npx mochawesome-merge screenshots/cypress_report_*.json -o screenshots/merged-report.json
```

Read `screenshots/merged-report.json` and extract:

For each test:
```
{
  spec_file: string,        // from results[].fullFile
  suite: string,            // from suites[].title
  test_name: string,        // from tests[].title
  full_title: string,       // from tests[].fullTitle
  state: "passed" | "failed" | "skipped",
  error_message: string,    // from tests[].err.message (if failed)
  stack_trace: string,      // from tests[].err.estack (if failed)
  duration_ms: number       // from tests[].duration
}
```

Build a failure list and a pass list.

**Note**: Mochawesome JSON has nested suites. Walk the tree recursively:
```
results[] -> suites[] -> tests[]
                      -> suites[] -> tests[]  (nested suites)
```

### Step 6: Identify Screenshots

For each failure, find the corresponding screenshot:

```bash
find /home/drajnoha/Code/monitoring-plugin/web/cypress/screenshots -name "*.png" -type f
```

Match screenshots to failures using the naming convention:
```
{Suite Name} -- {Test Title} (failed).png
{Suite Name} -- {Test Title} -- before all hook (failed).png
```

### Step 7: Diagnosis Loop

**If no failures** (exit code 0): Skip to Step 10 (flakiness probe).

**If failures exist**: For each failing test, spawn a **Diagnosis Agent** (Explore-type sub-agent).

Use the `/diagnose-test-failure` skill prompt. Provide:
- `test-name`: the full title
- `spec-file`: the spec file path
- `error-message`: the error message
- `screenshot-path`: absolute path to the failure screenshot
- `stack-trace`: the error stack trace
- `ci-context`: any relevant context from Step 0

**Parallelization**: If failures are in **different spec files**, spawn diagnosis agents in parallel. If they're in the **same spec file**, diagnose sequentially (they may share root causes like a broken `before all` hook).

**Before-all hook failures**: If a `before all` hook failed, all tests in that suite were skipped. Diagnose only the hook failure — fixing it will unblock all skipped tests.

Collect all diagnoses. Separate into:
- **Fixable**: `TEST_BUG`, `FIXTURE_ISSUE`, `PAGE_OBJECT_GAP`, `MOCK_ISSUE`
- **Blocking**: `REAL_REGRESSION`, `INFRA_ISSUE`

If any **blocking** issues found: Report them to the user. Continue fixing the fixable issues.

### Step 8: Fix Loop

For each fixable failure, spawn a **Fix Agent** (general-purpose sub-agent).

Provide the Fix Agent with:
1. The full diagnosis from Step 7
2. The test file content (read it)
3. The page object content (read `cypress/views/incidents-page.ts`)
4. The fixture content (if relevant)
5. These constraints:

```
## Fix Constraints

You may ONLY edit files in these paths:
- web/cypress/e2e/incidents/**/*.cy.ts (test files)
- web/cypress/fixtures/incident-scenarios/*.yaml (fixtures)
- web/cypress/views/incidents-page.ts (page object)
- web/cypress/support/incidents_prometheus_query_mocks/** (mock layer)

You must NOT edit:
- web/src/** (source code — that's Phase 2)
- Non-incident test files
- Cypress config or support infrastructure
- Any file outside the web/ directory

## Fix Guidelines

- Prefer the minimal change that fixes the issue
- Don't refactor surrounding code — only fix the failing test
- If adding a wait/timeout, prefer Cypress retry-ability (.should()) over cy.wait()
- If fixing a selector, check that the new selector exists in the current DOM
  by reading the relevant React component in src/ (read-only, don't edit)
- If fixing a fixture, validate it against the fixture schema
  (run /validate-incident-fixtures mentally or reference the schema)
- If adding a page object method, follow existing naming conventions
```

After the Fix Agent returns, verify the fix makes sense:
- Does the edit address the diagnosed root cause?
- Could the edit break other tests?
- Is it the minimal change needed?

If the fix looks wrong, re-diagnose with additional context.

### Step 9: Validate Fixes

After applying fixes, re-run **only the previously failing tests**:

```bash
cd /home/drajnoha/Code/monitoring-plugin/web && source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grep="{FAILING_TEST_NAME}"
```

For each test:
- **Now passes**: Stage the fix files with `git add`
- **Still fails**: Re-diagnose (increment retry counter). Max 2 retries per test.
- **After 2 retries still failing**: Mark as `UNRESOLVED` and report to user

### Step 10: Commit Batch

After all fixable failures are addressed (or max retries reached):

```bash
cd /home/drajnoha/Code/monitoring-plugin && git add <fixed-files> && git commit -m "<message>"
```

Commit message format:
```
fix(tests): <summary of what was fixed>

- <file>: <change description>
- <file>: <change description>

Classifications: N TEST_BUG, N FIXTURE_ISSUE, N PAGE_OBJECT_GAP, N MOCK_ISSUE
Unresolved: N (if any)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Track commit count. If commit count reaches **5**: Notify the user that the review threshold has been reached and ask whether to continue or pause for review.

### Step 11: Iterate

If there were failures and `current_iteration < max-iterations`:
- Increment iteration counter
- Go back to **Step 3** (clean results and re-run)

This catches cascading fixes — e.g., fixing a `before all` hook unblocks skipped tests that may have their own issues.

If all tests pass: Proceed to Step 12.

### Step 12: Flakiness Probe

Run the full target test suite `flakiness-runs` times (default: 3), even if everything is green.

For each run:
1. Clean previous results (Step 3)
2. Run tests (Step 4)
3. Parse results (Step 5)
4. Record per-test pass/fail

After all runs, compute flakiness:

```
Flakiness Report:
  Total tests: N
  Stable (all runs passed):  N
  Flaky (some runs failed):  N
  Broken (all runs failed):  N

  Flaky tests:
    - "test name" — passed 2/3 runs
      Error on failure: <error message>
    - "test name" — passed 1/3 runs
      Error on failure: <error message>
```

For each **flaky** test:
- Diagnose it using `/diagnose-test-failure` with the context that it's intermittent
- Common flaky patterns: race conditions, animation timing, network mock timing, DOM detach/reattach
- Apply fix if confident (add `.should('exist')` guards, use `{ timeout: N }`, avoid `.eq(N)` on dynamic lists)
- Re-run flakiness probe on just the fixed tests to verify

### Step 13: Final Report

Output a summary:

```
# Iteration Complete

## Branch: test/incident-robustness-YYYY-MM-DD
## Commits: N
## Iterations: N

## Results
- Tests run: N
- Passing: N
- Fixed in this session: N
- Unresolved: N (details below)
- Flaky (stabilized): N
- Flaky (remaining): N

## Fixes Applied
1. [commit-sha] fix(tests): <summary>
   - <file>: <change>

2. [commit-sha] fix(tests): <summary>
   - <file>: <change>

## Unresolved Issues
- "test name": REAL_REGRESSION — <description>. Source file X was modified in PR #N.
- "test name": UNRESOLVED after 2 retries — <last error>

## Remaining Flakiness
- "test name": 2/3 passed — timing issue in chart rendering, needs investigation

## Recommendations
- [Next steps for unresolved issues]
- [Whether to merge current fixes or wait]
```

### Error Handling

- **Cypress crashes** (not just test failures): Check if it's an OOM issue (`--max-old-space-size`), a missing dependency, or a config problem. Report to user.
- **No `export-env.sh`**: Remind user to run `/cypress-setup` first.
- **No mochawesome reports generated**: Check if the reporter config is correct. Fall back to parsing Cypress console output.
- **Git conflicts**: If the working branch has conflicts with changes, report to user and stop.
- **Sub-agent failure**: If a Diagnosis or Fix agent fails, log the error and skip that test. Don't let one broken agent block the whole loop.

### Guardrails

- **Never edit source code** (`src/`) in Phase 1
- **Never disable a test** — if a test can't be fixed, mark it as unresolved, don't add `.skip()`
- **Never add `@flaky` tag** to a test — that's a human decision
- **Never change test assertions to match wrong behavior** — if the UI is wrong, it's a REAL_REGRESSION
- **Max 2 retries per test** to avoid infinite loops
- **Max 5 commits before pausing** for user review
- **Always run flakiness probe** before declaring success
