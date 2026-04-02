# Agentic Test Iteration Architecture

Autonomous multi-agent system for iterating on Cypress test robustness, with visual feedback (screenshots + videos), CI result ingestion, and flakiness detection.

## Goals

| Phase | Objective |
|-------|-----------|
| **Phase 1** (current) | Make incident detection tests robust — fix selectors, timing, fixtures, page object gaps |
| **Phase 2** (future) | Refactor frontend code using tests as a behavioral contract / safety net |

## Architecture Overview

```
User: /iterate-incident-tests target=regression max-iterations=3

Coordinator (main Claude Code session)
  |
  |-- [CI Analysis] /analyze-ci-results (optional first step)
  |     Fetches CI artifacts, classifies infra vs test/code failures
  |     Correlates failures with git commits for context
  |     If all INFRA -> report to user and STOP
  |
  |-- Create branch: test/incident-robustness-<date>
  |
  |-- [Runner] Cypress headless via Bash (inline, not separate terminal)
  |     Sources export-env.sh, produces mochawesome JSON + screenshots + videos
  |
  |-- [Parser] Extract failures from mochawesome JSON reports
  |     Per failure: test name, error message, stack trace, screenshot path, video path
  |
  |-- For each failure (parallelizable):
  |     |
  |     |-- [Diagnosis Agent] (Explore-type sub-agent)
  |     |     Reads: screenshot (multimodal) + error + test code + fixture + page object
  |     |     Returns: root cause classification + recommended fix
  |     |
  |     |-- [Fix Agent] (general-purpose sub-agent)
  |     |     Makes targeted edits based on diagnosis
  |     |     Returns: diff summary
  |     |
  |     |-- [Validation] Re-run the specific failing test
  |           Pass -> stage fix
  |           Fail -> re-diagnose (max 2 retries per test)
  |
  |-- Commit batch of related fixes
  |-- Repeat if failures remain (up to max-iterations)
  |-- [Flakiness Probe] Run full suite 3x even if green
  |-- Report final state to user
```

## Agent Roles

### 1. Coordinator (main session)

Owns the iteration loop, branch management, and commit strategy.

Responsibilities:
- Create and manage the working branch
- Run Cypress tests inline via Bash
- Parse mochawesome JSON reports
- Dispatch Diagnosis and Fix agents
- Track cumulative pass/fail state across iterations
- Commit fixes in batches (threshold: **5 commits** before notifying user)
- Run flakiness probes (multiple runs even when green)
- Decide when to stop: all green + flakiness probe passed, max iterations, or needs human input

### 2. Diagnosis Agent (Explore-type sub-agent)

Input per failure:
- Error message and stack trace from mochawesome JSON
- Screenshot path (read with multimodal Read tool)
- Video path (reference for user, not directly parseable by agent)
- Test file path + relevant line numbers
- Associated fixture YAML
- Page object methods used

Output — one of these classifications:

| Classification | Description | Action |
|---------------|-------------|--------|
| `TEST_BUG` | Wrong selector, incorrect assertion, timing/race condition | Auto-fix |
| `FIXTURE_ISSUE` | Missing data, wrong structure, edge case not covered | Auto-fix |
| `PAGE_OBJECT_GAP` | Missing method, stale selector, outdated DOM reference | Auto-fix |
| `MOCK_ISSUE` | Intercept not matching, response shape wrong | Auto-fix |
| `REAL_REGRESSION` | Actual UI/code bug — not a test problem | **STOP and report to user** |
| `INFRA_ISSUE` | Cluster down, cert expired, operator not installed | **STOP and report to user** |

The agent should **read the screenshot first** before looking at code — visual state often reveals the root cause faster than stack traces.

### 3. Fix Agent (general-purpose sub-agent)

Input:
- Diagnosis classification and details
- Specific file references and what to change

Scope — may only edit:
- `cypress/e2e/incidents/**/*.cy.ts` (test files)
- `cypress/fixtures/incident-scenarios/*.yaml` (fixtures)
- `cypress/views/incidents-page.ts` (page object)
- `cypress/support/incidents_prometheus_query_mocks/**` (mock layer)

Must NOT edit:
- Source code (`src/`) — that's Phase 2
- Non-incident test files
- Cypress config or support infrastructure

### 4. Validation Agent

Re-runs the specific failing test after a fix is applied:
```bash
source cypress/export-env.sh && npx cypress run --env grep="<test name>" --spec "<spec file>"
```

Reports pass/fail. If still failing, feeds back to Diagnosis Agent (max 2 retries per test).

## Flakiness Detection

Even if the first run is all green, the coordinator runs a **flakiness probe**:

1. Run the full incident test suite 3 times consecutively
2. Track per-test results across runs
3. Flag any test that fails in any run as `FLAKY`
4. For flaky tests: attempt to diagnose the timing/race condition and fix
5. Report flakiness statistics: `test_name: 2/3 passed` etc.

This catches intermittent failures that a single run would miss.

## CI Result Ingestion

CI analysis is handled by the dedicated `/analyze-ci-results` skill (`.claude/commands/analyze-ci-results.md`).

The skill fetches artifacts from OpenShift CI (Prow) runs on GCS, classifies failures as infrastructure vs test/code issues, reads failure screenshots with multimodal vision, and correlates failures with the git commits that triggered them.

### Key Capabilities

- **URL normalization**: Accepts gcsweb or Prow UI URLs at any level of the artifact tree
- **Structured metadata**: Extracts PR number, author, branch, commit SHAs from `started.json` / `finished.json` / `prowjob.json`
- **Build log parsing**: Parses Cypress console output from `build-log.txt` for per-spec pass/fail/skip counts and error details
- **Visual diagnosis**: Fetches and reads failure screenshots (multimodal) to understand UI state at failure time
- **Failure classification**: Categorizes each failure as `INFRA_*` (cluster, operator, plugin, auth, CI) or test/code (`TEST_BUG`, `FIXTURE_ISSUE`, `PAGE_OBJECT_GAP`, `MOCK_ISSUE`, `CODE_REGRESSION`)
- **Commit correlation**: Maps failures to specific file changes in the PR using `git diff {base}..{pr_head}`

### Integration with Orchestrator

The orchestrator uses `/analyze-ci-results` as an optional first step:

1. If all failures are `INFRA_*` -> report to user and STOP (no test changes will help)
2. If mixed -> report infra issues, proceed with test/code fixes only
3. If all test/code -> proceed with full iteration loop
4. Commit correlation tells the orchestrator whether to fix tests or investigate source changes
5. CI screenshots give the Diagnosis Agent a head start before local reproduction

### Usage

```
/analyze-ci-results ci-url=https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/.../{RUN_ID}/
/analyze-ci-results ci-url=https://prow.ci.openshift.org/view/gs/.../{RUN_ID} focus=regression
```

## Commit Strategy

- **Branch naming**: `test/incident-robustness-YYYY-MM-DD`
- **Commit granularity**: Group related fixes (e.g., "fix 3 selector issues in filtering tests")
- **Review threshold**: Notify user after **5 commits** for review
- **Never force-push**; always additive commits
- User merges when ready, or continues iteration

## Test Execution (Inline)

Tests run inline via Bash, not in a separate terminal:

```bash
cd web && source cypress/export-env.sh && \
  npx cypress run \
    --spec "cypress/e2e/incidents/regression/**/*.cy.ts" \
    --env grepTags="@incidents --@e2e-real --@flaky" \
    --reporter ./node_modules/cypress-multi-reporters \
    --reporter-options configFile=reporter-config.json
```

Results are collected from:
- **Exit code**: 0 = all passed, non-zero = failures
- **Mochawesome JSON**: `screenshots/cypress_report_*.json` — per-test details
- **Screenshots**: `cypress/screenshots/{spec}/` — failure screenshots
- **Videos**: `cypress/videos/{spec}.mp4` — kept on failure

### Report Parsing

Mochawesome JSON structure (per report file):
```json
{
  "stats": { "passes": N, "failures": N, "skipped": N },
  "results": [{
    "suites": [{
      "title": "Suite Name",
      "tests": [{
        "title": "test description",
        "fullTitle": "Suite -- test description",
        "state": "failed|passed|skipped",
        "err": {
          "message": "error description",
          "estack": "full stack trace"
        }
      }]
    }]
  }]
}
```

Use `npx mochawesome-merge screenshots/cypress_report_*.json > merged-report.json` to combine per-spec reports.

## Skills

| Skill | Purpose | Invoked by |
|-------|---------|------------|
| `/iterate-incident-tests` | Main orchestrator — local iteration loop, dispatches agents, manages commits | User |
| `/iterate-ci-flaky` | CI-based iteration — push fixes, trigger Prow jobs, wait, analyze, repeat | User |
| `/diagnose-test-failure` | Classifies a single test failure using screenshots + code analysis | Orchestrator (as sub-agent prompt) |
| `/analyze-ci-results` | Fetches and analyzes OpenShift CI artifacts, classifies infra vs test/code | User or orchestrator |

Skills are defined in `.claude/commands/` and can be invoked as slash commands.

## Existing Infrastructure Leveraged

| Asset | How the agent uses it |
|-------|----------------------|
| mochawesome JSON reporter | Structured test results parsing |
| `@cypress/grep` | Run individual tests by name or tag |
| `export-env.sh` | Source env vars for inline execution |
| YAML fixture system | Edit fixtures to fix data issues |
| Page object (`incidents-page.ts`) | Fix selectors and add missing methods |
| Mock layer (`incidents_prometheus_query_mocks/`) | Fix intercept patterns |
| `/generate-incident-fixture` skill | Generate new fixtures when needed |
| `/validate-incident-fixtures` skill | Validate fixture edits |

## Phase 2: Frontend Refactoring (Future)

### Concept

Tests become the behavioral contract. The agent refactors frontend code while using the test suite as a safety net.

### Additional Agent Roles

| Agent | Role |
|-------|------|
| **Refactor Planner** | Analyzes frontend code, proposes refactoring steps |
| **Refactor Agent** | Makes code changes (replaces Fix Agent) |
| **Contract Validator** | Runs tests, classifies failures as regression vs test-coupling |
| **Test Adapter** | Updates tests that assert implementation details instead of behavior |

### Key Principle

If a test breaks due to refactoring but behavior is preserved, the test needs updating — it was too coupled to implementation. Phase 1 (robustness) reduces this coupling, making Phase 2 more effective.

### Additional Classification

The Diagnosis Agent gains `TEST_TOO_COUPLED` — the test asserts implementation details (specific DOM structure, internal state) rather than observable behavior. The Test Adapter agent rewrites it to be implementation-agnostic.
