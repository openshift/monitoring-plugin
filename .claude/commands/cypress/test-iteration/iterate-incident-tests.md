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
    description: "Optional: gcsweb or Prow URL for CI results to use as starting context (triggers /cypress:test-iteration:analyze-ci-results first)"
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

## Prerequisites

### 1. Cypress Environment

Ensure `web/cypress/export-env.sh` exists with cluster credentials. If missing, create it directly — do NOT run the interactive `/cypress:setup` configurator. Use the cluster credentials provided in the conversation (console URL, kubeadmin password) to write the file:

```bash
cat > web/cypress/export-env.sh << 'EOF'
# shellcheck shell=bash
export CYPRESS_BASE_URL='<console-url>'
export CYPRESS_LOGIN_IDP='kube:admin'
export CYPRESS_LOGIN_USERS='kubeadmin:<password>'
export CYPRESS_KUBECONFIG_PATH='/tmp/kubeconfig'
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='true'
export CYPRESS_SKIP_KBV_INSTALL='true'
export CYPRESS_KBV_UI_INSTALL='false'
export CYPRESS_TIMEZONE='UTC'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
export CYPRESS_DEBUG='false'
EOF
```

### 2. Permissions

This skill runs autonomously and needs pre-approved permissions in `.claude/settings.local.json` to avoid interactive approval prompts blocking the loop. Required permissions:

```json
{
  "permissions": {
    "allow": [
      "Bash(git stash:*)",
      "Bash(git checkout:*)",
      "Bash(git checkout -b:*)",
      "Bash(git branch:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(rm -f screenshots/cypress_report_*.json:*)",
      "Bash(rm -f screenshots/merged-report.json:*)",
      "Bash(rm -rf cypress/screenshots/*:*)",
      "Bash(rm -rf cypress/videos/*:*)",
      "Bash(npx cypress run:*)",
      "Bash(npx mochawesome-merge:*)",
      "Bash(source cypress/export-env.sh:*)",
      "Bash(cd /home/drajnoha/Code/monitoring-plugin:*)",
      "Bash(find /home/drajnoha/Code/monitoring-plugin/web/cypress:*)",
      "Bash(ls:*)"
    ]
  }
}
```

The `rm` permissions are scoped to test artifact directories only (mochawesome reports, screenshots, videos) — these are regenerated every run.

### 3. Unsigned Commits

All commits in this workflow use `--no-gpg-sign` to avoid GPG passphrase prompts blocking the loop. These unsigned commits live on a working branch and are intended to be **squash-merged** by the user with their own signature when approved. Never push unsigned commits directly to main.

If using CI analysis, also add to `web/.claude/settings.local.json`:
```json
"WebFetch(domain:gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com)"
```

## Instructions

Execute the following steps in order. This is the main orchestrator — it coordinates sub-agents and manages the iteration loop.

### Step 0: CI Context (optional)

If `ci-url` is provided, run `/cypress:test-iteration:analyze-ci-results` first to get CI failure context.

Capture the CI analysis output:
- If **all failures are INFRA_***: Report the infrastructure issues to the user and **STOP**. No test changes will help.
- If **mixed infra + test/code**: Note the infra issues for the user, but proceed with the test/code failures only.
- If **all test/code**: Proceed. Use the CI diagnosis (commit correlation, screenshots) as context for the local iteration.

Store the CI analysis as `ci_context` for later reference by diagnosis agents.

### Step 1: Branch Setup

First, check the current branch:
```bash
git rev-parse --abbrev-ref HEAD
```

**Decision logic:**
- If `skip-branch` is "true": Stay on the current branch, skip to Step 3.
- If already on a `test/incident-robustness-*` branch: Stay on it, skip to Step 3.
- If on any other non-main working branch (e.g., `agentic-test-iteration`, a feature branch): Ask the user whether to create a child branch or work on the current one.
- If on `main`: Create a new branch.

To create a branch (only when needed):
```bash
git checkout -b test/incident-robustness-$(date +%Y-%m-%d)
```

If that branch name already exists, append a suffix: `-2`, `-3`, etc.

**IMPORTANT**: Do NOT combine `cd` and `git` in the same command — compound `cd && git` commands trigger a security approval prompt that blocks autonomous execution. Always use separate Bash calls, or set the working directory before running git.

### Step 2: Read Stability Ledger

Read `web/cypress/reports/test-stability.md` and parse the JSON block between `STABILITY_DATA_START` and `STABILITY_DATA_END`.

Extract a compressed summary for use during diagnosis:

```
Stability context (from {N} previous runs):
  Known flaky:
    - "test full title" — passed {X}/{Y} runs, last failure: {date}, reason: {reason}
    - "test full title" — passed {X}/{Y} runs, last failure: {date}, reason: {reason}
  Recently fixed:
    - "test full title" — fixed by {commit}, stable since {date}
  Persistent failures:
    - "test full title" — failed {X}/{Y} runs, never fixed
```

If the ledger has no data yet (first run), note "No prior stability data" and continue.

Store this as `stability_context` — it will be passed to Diagnosis Agents in Step 8 to help them:
- Prioritize known-flaky tests (these are higher value to fix)
- Avoid re-attempting fixes that already failed in previous runs
- Distinguish new failures from recurring ones

### Step 3: Resolve Target

Based on the `target` parameter, determine the Cypress run command:

| Target | Spec | Grep Tags |
|--------|------|-----------|
| `all` | `cypress/e2e/incidents/**/*.cy.ts` | `@incidents --@e2e-real --@flaky --@demo` |
| `regression` | `cypress/e2e/incidents/regression/**/*.cy.ts` | `@incidents --@e2e-real --@flaky` |
| specific file | `cypress/e2e/incidents/{target}` | (none) |
| grep pattern | `cypress/e2e/incidents/**/*.cy.ts` | (none, use `--env grepTags="{target}"`) |

### Step 4: Clean Previous Results

From the `web/` directory:
```bash
bash scripts/clean-test-artifacts.sh
```

### Step 5: Run Tests

Execute Cypress inline (NOT in a separate terminal). From the `web/` directory:

```bash
source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grepTags="{GREP_TAGS}"
```

Where `{GREP_TAGS}` comes from the "Grep Tags" column in the target table above. If the target has no grep tags, omit the `--env` flag entirely.

**IMPORTANT**: Use `grepTags` (not `grep`). The `grep` option searches test names as text, while `grepTags` filters by `@tag` annotations. Using `grep` with tag strings like `@incidents --@e2e-real` will match nothing and cause all specs to run unfiltered.

Note: `source && npx` is one logical operation (env setup + run) and is acceptable as a single command.

**IMPORTANT**: Tests can run for a long time, especially e2e tests that wait for alerts to fire. Use `run_in_background` to avoid blocking, and check the output when notified of completion.

Capture the exit code:
- `0` = all passed
- non-zero = failures occurred

### Step 6: Parse Results

Merge mochawesome reports and parse. From the `web/` directory:

```bash
npx mochawesome-merge screenshots/cypress_report_*.json -o screenshots/merged-report.json
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

### Step 7: Identify Screenshots

For each failure, find the corresponding screenshot:

```bash
find /home/drajnoha/Code/monitoring-plugin/web/cypress/screenshots -name "*.png" -type f
```

Match screenshots to failures using the naming convention:
```
{Suite Name} -- {Test Title} (failed).png
{Suite Name} -- {Test Title} -- before all hook (failed).png
```

### Step 8: Diagnosis Loop

**If no failures** (exit code 0): Skip to Step 13 (flakiness probe).

**If failures exist**: For each failing test, spawn a **Diagnosis Agent** (Explore-type sub-agent).

Use the `/cypress:test-iteration:diagnose-test-failure` skill prompt. Provide:
- `test-name`: the full title
- `spec-file`: the spec file path
- `error-message`: the error message
- `screenshot-path`: absolute path to the failure screenshot
- `stack-trace`: the error stack trace
- `ci-context`: any relevant context from Step 0
- `stability-context`: the compressed stability summary from Step 2 (prior flakiness history, previous failure patterns, previously attempted fixes)

**Parallelization**: If failures are in **different spec files**, spawn diagnosis agents in parallel. If they're in the **same spec file**, diagnose sequentially (they may share root causes like a broken `before all` hook).

**Before-all hook failures**: If a `before all` hook failed, all tests in that suite were skipped. Diagnose only the hook failure — fixing it will unblock all skipped tests.

Collect all diagnoses. Separate into:
- **Fixable**: `TEST_BUG`, `FIXTURE_ISSUE`, `PAGE_OBJECT_GAP`, `MOCK_ISSUE`
- **Blocking**: `REAL_REGRESSION`, `INFRA_ISSUE`

If any **blocking** issues found: Report them to the user. Continue fixing the fixable issues.

### Step 9: Fix Loop

For each fixable failure, spawn a **Fix Agent** (general-purpose sub-agent).

Provide the Fix Agent with:
1. The full diagnosis from Step 8
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
  (run /cypress:test-development:validate-incident-fixtures mentally or reference the schema)
- If adding a page object method, follow existing naming conventions
- **Before applying any fix, check git history** for the file being changed:
  `git log origin/main -- <file>` — look for prior commits that explicitly
  removed or replaced the pattern you are about to introduce. For example,
  `cy.reload()` was previously removed from prepareIncidentsPageForSearch
  because it breaks dynamic plugin chunk loading in headless CI. The iteration
  agent lacks git history context and will re-discover "fixes" that were
  already tried and reverted. If a prior commit removed the pattern for a
  documented reason, do NOT re-introduce it.
```

After the Fix Agent returns, verify the fix makes sense:
- Does the edit address the diagnosed root cause?
- Could the edit break other tests?
- Is it the minimal change needed?

If the fix looks wrong, re-diagnose with additional context.

### Step 10: Validate Fixes

After applying fixes, re-run **only the previously failing tests**:

From the `web/` directory:
```bash
source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grepTags="{FAILING_TEST_TAGS}"
```

For each test:
- **Now passes**: Stage the fix files with `git add`
- **Still fails**: Re-diagnose (increment retry counter). Max 2 retries per test.
- **After 2 retries still failing**: Mark as `UNRESOLVED` and report to user

### Step 11: Commit Batch

After all fixable failures are addressed (or max retries reached):

Stage and commit as separate commands (never chain `cd && git`):
```bash
git add <fixed-files>
```
```bash
git commit --no-gpg-sign -m "<message>"
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

### Step 12: Iterate

If there were failures and `current_iteration < max-iterations`:
- Increment iteration counter
- Go back to **Step 4** (clean results and re-run)

This catches cascading fixes — e.g., fixing a `before all` hook unblocks skipped tests that may have their own issues.

If all tests pass: Proceed to Step 13.

### Step 13: Flakiness Probe

Run the full target test suite `flakiness-runs` times (default: 3), even if everything is green.

For each run:
1. Clean previous results (Step 4)
2. Run tests (Step 5)
3. Parse results (Step 6)
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
- Diagnose it using `/cypress:test-iteration:diagnose-test-failure` with the context that it's intermittent
- Common flaky patterns: race conditions, animation timing, network mock timing, DOM detach/reattach
- Apply fix if confident (add `.should('exist')` guards, use `{ timeout: N }`, avoid `.eq(N)` on dynamic lists)
- Re-run flakiness probe on just the fixed tests to verify

### Step 14: Final Report

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

### Step 15: Update Stability Ledger

After the final report, update `web/cypress/reports/test-stability.md`.

Read the file and update both sections:

**1. Current Status table** — for each test in this run:
- If test already in table: update pass rate (rolling average across all recorded runs), update trend
- If test is new: add a row
- Pass rate = total passes / total runs across all recorded iterations
- Trend: compare last 3 runs — improving / stable / degrading

**2. Run History log** — append a new row:
```
| {next_number} | {YYYY-MM-DD} | local | {branch} | {total_tests} | {passed} | {failed} | {flaky} | {commit_sha} |
```

**3. Machine-readable data** — update the JSON block between `STABILITY_DATA_START` and `STABILITY_DATA_END`:
```json
{
  "tests": {
    "test full title": {
      "results": ["pass", "pass", "fail", "pass"],
      "last_failure_reason": "Timed out...",
      "last_failure_date": "2026-03-23",
      "fixed_by": "abc1234"
    }
  },
  "runs": [
    {
      "date": "2026-03-23",
      "type": "local",
      "branch": "test/incident-robustness-2026-03-23",
      "total": 15,
      "passed": 15,
      "failed": 0,
      "flaky": 0,
      "commit": "abc1234"
    }
  ]
}
```

Commit the ledger update together with the final batch of fixes if any, or as a standalone commit:
```bash
git add web/cypress/reports/test-stability.md
```
```bash
git commit --no-gpg-sign -m "docs: update test stability ledger — {passed}/{total} passed, {flaky} flaky"
```

### Error Handling

- **Cypress crashes** (not just test failures): Check if it's an OOM issue (`--max-old-space-size`), a missing dependency, or a config problem. Report to user.
- **No `export-env.sh`**: Create it directly using the cluster credentials from the conversation. Do NOT use the interactive `/cypress:setup`.
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
