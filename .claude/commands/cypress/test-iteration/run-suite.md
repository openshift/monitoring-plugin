# Run Suite

Layer 1 primitive: execute Cypress for a given spec and grep tags, merge mochawesome reports, collect failure screenshots, and return structured per-test results.

**Does NOT**: diagnose failures, fix anything, clean artifacts before running, manage the stability ledger, or know which setup profile is in use. The caller is responsible for cleaning artifacts before calling and for diagnosing the results after.

**Prerequisite**: `ensure-env` must have been called once this session before the first `run-suite`. Environment vars are read from `web/cypress/export-env.sh` via `source`.

## Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `spec` | yes | Spec file path or glob, already resolved by caller (e.g. `cypress/e2e/incidents/**/*.cy.ts`) |
| `grep-tags` | no | Value for `grepTags` env var (e.g. `@incidents --@e2e-real --@flaky`). Omit entirely if no tag filtering is needed. |
| `run-label` | no | Label for this run in the output block (default: `run-1`). Use descriptive labels like `iteration-2`, `validate-iteration-1`, `probe-2`, `ci-local-validate`. |

## Steps

### Step 1: Execute Cypress

From the `web/` directory, run in background (tests can take many minutes):

```bash
source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grepTags="{GREP_TAGS}"
```

If `grep-tags` is not provided, omit `--env grepTags=...` entirely:
```bash
source cypress/export-env.sh && npx cypress run --spec "{SPEC}"
```

**IMPORTANT**: Use `grepTags` (not `grep`). The `grep` option matches test title text; `grepTags` filters by `@tag` annotations. Using `grep` with tag strings like `@incidents --@e2e-real` will match nothing and run all specs unfiltered.

Capture the exit code:
- `0` = all tests passed
- non-zero = one or more failures (or Cypress crash)

### Step 2: Merge mochawesome reports

```bash
npx mochawesome-merge screenshots/cypress_report_*.json -o screenshots/merged-report.json
```

If no `cypress_report_*.json` files exist (Cypress crashed before producing any): emit the output block with exit code, 0 results, and a note about the crash. Do not fail silently.

### Step 3: Parse results

Read `screenshots/merged-report.json`.

Walk the mochawesome JSON tree recursively (suites can be nested):
```
results[] → suites[] → tests[]
                     → suites[] → tests[]   (nested suites)
```

For each test, extract:
```
{
  spec_file:     results[].fullFile,
  suite:         suites[].title (innermost containing suite),
  test_name:     tests[].title,
  full_title:    tests[].fullTitle,
  state:         "passed" | "failed" | "pending",
  error_message: tests[].err.message  (if state=failed, else null),
  stack_trace:   tests[].err.estack   (if state=failed, else null),
  duration_ms:   tests[].duration
}
```

### Step 4: Map screenshots to failures

```bash
find cypress/screenshots -name "*.png" -type f
```

For each failure, find the matching screenshot using this naming convention:
```
{Suite Name} -- {Test Title} (failed).png
{Suite Name} -- {Test Title} -- before all hook (failed).png
```

Match by normalizing both sides: strip path, strip `.png`, compare `{Suite} -- {Test}` prefix against the test's `full_title`.

### Step 5: Emit output block

```
## RUN-SUITE: {run-label}

- Spec: {spec}
- GrepTags: {grep-tags | none}
- Exit code: {0 | N}
- Duration: {total duration}
- Total: {N}  |  Passed: {N}  |  Failed: {N}  |  Skipped: {N}

### Results

- [pass] "{full_title}" ({duration_ms}ms)
- [fail] "{full_title}" ({duration_ms}ms)
  - Error: {error_message}
  - Screenshot: {absolute path | none}
  - Stack (first 3 lines):
    {line 1}
    {line 2}
    {line 3}
- [skip] "{full_title}"
```

List all tests. For passed tests, include duration but omit error/screenshot/stack. For skipped/pending tests, note them briefly.

**Note on before-all hook failures**: If a `before all` hook failed, mochawesome records the hook error but marks subsequent tests as pending/skipped. Identify the hook error from `suites[].hooks[]` and include it as a pseudo-failure entry at the top of that suite's results:
```
- [fail] "{Suite Title} — before all hook"
  - Error: {hook error message}
  - Screenshot: {path | none}
```

This ensures the caller's diagnosis loop targets the hook, not the silently-skipped tests.
