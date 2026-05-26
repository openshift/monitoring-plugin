# Run and Report

Layer 3 developer DX skill: single-pass full execution. Run the test suite, diagnose any failures, and emit a structured report. The entry point for day-to-day developer use when you want one command to run tests and get an analyzed breakdown of what's wrong.

**Does NOT**: branch, iterate, fix anything, commit, or push. All of those belong to `iterate-incident-tests`.

## Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `target` | yes | `all` / `regression` / spec file path / grep pattern |
| `setup-profile` | no | `incidents` / `full-ui-install` / `skip-all-install` / `custom-images`. Passed to `ensure-env`; prompts if absent and not already configured. |
| `stability-context` | no | Compressed ledger summary from a prior run (passed to diagnose sub-agents as prior flakiness context) |
| `ci-context` | no | CI analysis output from `analyze-ci-results` (passed to diagnose sub-agents for additional context) |

## Steps

### Step 1: Ensure environment

Call `/cypress:test-iteration:ensure-env` with `setup-profile` (if provided).

If it returns `ENV_READY: no`: stop and report the reason to the user. Do not proceed.

### Step 2: Resolve target

Based on the `target` parameter, determine the Cypress spec and grep tags:

| Target | Spec | Grep Tags |
|--------|------|-----------|
| `all` | `cypress/e2e/incidents/**/*.cy.ts` | `@incidents --@e2e-real --@flaky --@demo` |
| `regression` | `cypress/e2e/incidents/regression/**/*.cy.ts` | `@incidents --@e2e-real --@flaky` |
| specific file | Use target as-is | (none) |
| grep pattern | `cypress/e2e/incidents/**/*.cy.ts` | `{target}` |

### Step 3: Clean artifacts

From the `web/` directory:
```bash
bash scripts/clean-test-artifacts.sh
```

### Step 4: Run suite

Call `/cypress:test-iteration:run-suite` with:
- `spec`: resolved from Step 2
- `grep-tags`: resolved from Step 2 (omit if none)
- `run-label`: `run-and-report`

Capture the full output block.

### Step 5: If all passed

If exit code is `0` and no failures in the results:

Emit:
```
# Run and Report: All Passed ✓

Target: {target}
Profile: {profile}
Total: {N} tests  |  Duration: {duration}

All {N} tests passed.
```

Update the stability ledger (Step 8) and exit.

### Step 6: Diagnose failures

For each failing test in the run-suite output, spawn a **Diagnosis Agent** using the `/cypress:test-iteration:diagnose-test-failure` skill.

Provide:
- `test-name`: full_title from run-suite output
- `spec-file`: spec_file from run-suite output
- `error-message`: error_message from run-suite output
- `screenshot-path`: matched screenshot path (or none)
- `stack-trace`: first 3 lines of stack_trace
- `stability-context`: the `stability-context` param (if provided)
- `ci-context`: the `ci-context` param (if provided)

**Parallelization**: Spawn diagnosis agents in parallel for failures in different spec files. For failures in the same spec file, run sequentially (they may share a root cause like a broken `before all` hook).

**Before-all hook failures**: If a hook failed, diagnose only the hook — fixing it will unblock the silently-skipped tests.

Collect all diagnoses. Classify into:
- **Fixable**: `TEST_BUG`, `FIXTURE_ISSUE`, `PAGE_OBJECT_GAP`, `MOCK_ISSUE`
- **Blocking**: `REAL_REGRESSION`, `INFRA_ISSUE`

### Step 7: Emit final report

```
# Run and Report

Target: {target}
Profile: {profile}
Total: {N}  |  Passed: {N}  |  Failed: {N}  |  Duration: {duration}

## Failures

### 1. "{full_title}"
- Spec: {spec_file}
- Error: {error_message}
- Screenshot: {path | none}
- Classification: {CLASSIFICATION}
- Root cause: {diagnosis root cause}
- Recommended fix: {recommended fix}
- Fixable in test layer: {yes | no}

### 2. ...

## Summary

- Fixable (test/fixture/page-object/mock layer): {N}
  {list each}
- Blocking (real regression or infra): {N}
  {list each}
- All passed: {yes | no}

## Blocking Issues (Requires Attention)

{For each REAL_REGRESSION or INFRA_ISSUE:}
- "{test_name}": {classification} — {root cause}
  {Recommended action for the human}
```

If all failures are blocking issues (no fixable items), note this clearly so the developer knows not to attempt test-layer fixes.

### Step 8: Update stability ledger

Read `web/cypress/reports/test-stability.md` and update both sections:

**Current Status table** — for each test in this run:
- If test already in table: update pass rate (rolling average across all recorded runs), update trend (last 3 runs: improving / stable / degrading)
- If new test: add a row

**Run History log** — append:
```
| {next_number} | {YYYY-MM-DD} | local | {current-branch} | {total} | {passed} | {failed} | 0 | {HEAD short sha} |
```

**Machine-readable JSON block** — update `STABILITY_DATA_START...STABILITY_DATA_END`:
- For each test: append `"pass"` or `"fail"` to its `results[]` array; update `last_failure_reason`, `last_failure_date` if failed
- For runs: append a new run object

Do NOT commit the ledger — `run-and-report` does not commit anything. The ledger update is written to disk for the developer to inspect and commit themselves.
