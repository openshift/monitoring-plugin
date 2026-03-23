---
name: iterate-ci-flaky
description: Iterate on flaky Cypress tests against OpenShift CI presubmit jobs — push fixes, trigger CI, analyze results, repeat
parameters:
  - name: pr
    description: "PR number to iterate on (e.g., 857)"
    required: true
  - name: max-iterations
    description: "Maximum fix-push-wait cycles (default: 3)"
    required: false
  - name: confirm-runs
    description: "Number of green CI runs required to declare stable (default: 2)"
    required: false
  - name: job
    description: "Prow job name to target (default: pull-ci-openshift-monitoring-plugin-main-e2e-incidents)"
    required: false
  - name: focus
    description: "Optional: focus analysis on specific test area (e.g., 'regression', 'filtering')"
    required: false
---

# Iterate CI Flaky Tests

Fix flaky Cypress tests by iterating against real OpenShift CI presubmit jobs. Pushes fixes, triggers CI, waits for results, analyzes failures, and repeats until stable.

## Prerequisites

### 1. GitHub CLI Authentication

```bash
gh auth status
```

Must be logged in with comment access to `openshift/monitoring-plugin` (for `/test` comments to trigger Prow CI).

**Recommended auth method**: `gh auth login --web` (OAuth via browser). This uses your GitHub user's existing org permissions — no PAT scope management needed. Revocable anytime at GitHub → Settings → Applications.

**Why not a PAT?**
- Fine-grained PATs can only scope repos you own — you can't add `openshift/monitoring-plugin` as a contributor.
- Classic PATs with `public_repo` scope work but grant broader access than needed.
- OAuth via `--web` uses the GitHub CLI OAuth app which requests only the permissions it needs and inherits your org membership.

**Push access**: Git push to your fork uses SSH (`origin` remote) — this is independent of the `gh` token.

**Fallback**: If the token lacks upstream comment permissions, the agent will report the blocker and ask you to post the `/test` comment manually on the PR page.

### 2. Permissions

Required in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(gh auth:*)",
      "Bash(gh api:*)",
      "Bash(gh pr:*)",
      "Bash(git push:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git rev-parse:*)",
      "Bash(git -C:*)",
      "Bash(git checkout:*)",
      "Bash(git fetch:*)",
      "Bash(python3:*)",
      "Bash(find screenshots:*)",
      "Bash(find cypress/screenshots:*)",
      "Bash(find cypress/videos:*)",
      "WebFetch(domain:gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com)"
    ]
  }
}
```

### 3. Unsigned Commits

Same as `/iterate-incident-tests` — all commits use `--no-gpg-sign`. They live on a PR branch and are squash-merged by the user.

## Instructions

**IMPORTANT — Autonomous Execution Rules:**
- **Never chain commands** with `&&` or `|` — use separate Bash calls for each operation. Compound commands and pipes trigger security prompts that block autonomous execution.
- **Never combine `cd` with other commands** — `cd && git` triggers an unskippable security prompt.
- When you need to process command output (e.g., parse JSON), capture it with a Bash call first, then process it in a second call or read the output directly.

### Step 1: Gather PR Context

Fetch PR metadata:
```bash
gh pr view {pr} --json headRefName,headRefOid,baseRefName,number,title,url,author,statusCheckRollup
```

Extract:
- **Branch**: `headRefName`
- **HEAD SHA**: `headRefOid`
- **Check runs**: from `statusCheckRollup`, find the job matching `{job}` (default: `pull-ci-openshift-monitoring-plugin-main-e2e-incidents`)

Check out the PR branch locally:
```bash
git fetch origin {headRefName}
```
```bash
git checkout {headRefName}
```

Present summary:
```
PR #{pr}: {title}
Branch: {headRefName}
HEAD: {short_sha}
CI job: {job}
Latest run status: {SUCCESS|FAILURE|PENDING|none}
```

### Step 2: Determine Current CI State

From the status check rollup, determine the state of the target job:

- **SUCCESS**: Skip to Step 5 (flakiness confirmation — was it truly stable?)
- **FAILURE**: Proceed to Step 3 (analyze the failure)
- **PENDING / IN_PROGRESS**: Skip to Step 4 (wait for it)
- **No run found**: Trigger one in Step 3

### Step 3: Trigger CI Run (if needed)

If there's no recent run, or a fix was just pushed:

```bash
gh api repos/openshift/monitoring-plugin/issues/{pr}/comments -f body="/test pull-ci-openshift-monitoring-plugin-main-e2e-incidents"
```

Note: If you just pushed a commit in Step 6, the push automatically triggers Prow — you can skip the `/test` comment. Only use `/test` for:
- Retriggering without code changes (flakiness retry)
- The initial run if none exists

After triggering, proceed to Step 4.

### Step 4: Wait for CI Completion

Poll the PR check status. Use separate commands — no pipes.

**Polling approach**: Run a single self-contained background script that writes results to a temp file. No pipes between commands.

```bash
python3 -c "
import subprocess, json, time, sys
job = 'pull-ci-openshift-monitoring-plugin-main-e2e-incidents'
pr = '{pr}'
for attempt in range(30):
    result = subprocess.run(['gh', 'pr', 'checks', pr, '--json', 'name,state,detailsUrl'], capture_output=True, text=True)
    if result.returncode != 0:
        time.sleep(300)
        continue
    checks = json.loads(result.stdout)
    for c in checks:
        if job in c.get('name', ''):
            state = c['state']
            url = c.get('detailsUrl', '')
            if state in ('SUCCESS', 'FAILURE'):
                print(f'CI_COMPLETE state={state} url={url}')
                sys.exit(0)
            print(f'CI_PENDING state={state}, attempt {attempt+1}/30, sleeping 5m...')
            break
    time.sleep(300)
print('CI_TIMEOUT')
sys.exit(1)
"
```

Run this with `run_in_background: true` and a timeout of 9000000ms (150 minutes).

When the background task completes, parse the output line starting with `CI_COMPLETE`:
- Extract `state` (SUCCESS or FAILURE)
- Extract `url` (Prow URL for the run)

### Step 5: Analyze CI Results

Convert the Prow URL to a gcsweb URL:
- Replace `https://prow.ci.openshift.org/view/gs/` with `https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/`

Run `/analyze-ci-results` (or follow its instructions inline):

1. Fetch `started.json`, `finished.json`, `prowjob.json` for metadata
2. Fetch `build-log.txt` from the test artifacts path
3. List and fetch failure screenshots
4. Classify each failure

**Classification outcomes:**

| Classification | Action |
|---------------|--------|
| `INFRA_*` | Report to user. Optionally retrigger with `/retest` (Step 3). Do NOT attempt code fixes. |
| `TEST_BUG` | Diagnose and fix locally (Step 6) |
| `FIXTURE_ISSUE` | Diagnose and fix locally (Step 6) |
| `PAGE_OBJECT_GAP` | Diagnose and fix locally (Step 6) |
| `MOCK_ISSUE` | Diagnose and fix locally (Step 6) |
| `CODE_REGRESSION` | Report to user and **STOP** |

If **all green** (SUCCESS): Proceed to Step 7 (flakiness confirmation).

### Step 6: Fix and Push

For each fixable failure:

1. **Diagnose** using `/diagnose-test-failure` (read screenshots, test code, fixtures, page object)
2. **Fix** — edit the relevant files. Same constraints as `/iterate-incident-tests`:
   - May edit: `cypress/e2e/incidents/**`, `cypress/fixtures/incident-scenarios/**`, `cypress/views/incidents-page.ts`, `cypress/support/incidents_prometheus_query_mocks/**`
   - Must NOT edit: `src/**`, non-incident tests, cypress config
3. **Validate locally** (optional but recommended if cluster is accessible):
   ```bash
   source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grep="{TEST_NAME}"
   ```
4. **Commit and push**:
   ```bash
   git add {files}
   ```
   ```bash
   git commit --no-gpg-sign -m "fix(tests): {summary}

   CI run: {prow_url}
   Classifications: {list}

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
   ```
   ```bash
   git push origin {headRefName}
   ```

The push automatically triggers a new Prow run. Go to **Step 4** (wait for CI).

Track iteration count. If `current_iteration >= max-iterations`: Report remaining failures and **STOP**.

### Step 7: Flakiness Confirmation

A single green CI run doesn't prove stability. Trigger `confirm-runs` additional runs (default: 2) to confirm.

For each confirmation run:

1. Trigger via `/test` comment (no code changes):
   ```bash
   gh api repos/openshift/monitoring-plugin/issues/{pr}/comments -f body="/test pull-ci-openshift-monitoring-plugin-main-e2e-incidents"
   ```

2. Wait for completion (Step 4)

3. Analyze results (Step 5)

4. If failures found:
   - If same test fails across runs → likely a real bug, diagnose and fix (Step 6)
   - If different tests fail across runs → environment-dependent flakiness, harder to fix
   - Report flakiness pattern to user

Track results across all runs:
```
Stability Report:
  Run 1 (fix iteration): {SHA} — PASSED
  Run 2 (confirm #1):    {SHA} — PASSED
  Run 3 (confirm #2):    {SHA} — PASSED (or FAILED: test X)
```

### Step 8: Final Report

```
# CI Flaky Test Iteration Report

## PR: #{pr} - {title}
## Branch: {headRefName}
## Iterations: {N}

## Timeline
1. [SHA] Initial state — CI FAILURE
   - {N} failures: {test names}
2. [SHA] fix(tests): {summary} — pushed, CI triggered
3. [SHA] CI result: PASSED
4. Confirmation run 1: PASSED
5. Confirmation run 2: PASSED

## Fixes Applied
1. [commit] fix(tests): {summary}
   - {file}: {change}
   CI run: {prow_url}

## Stability Assessment
- Tests stable: {N}/{total} (passed all runs)
- Tests flaky: {N} (intermittent failures)
- Tests broken: {N} (failed every run)

## Flaky Test Details (if any)
- "test name": passed 2/3 runs
  Failure pattern: {timing issue / element not found / etc.}
  Fix attempted: {yes/no}

## Remaining Issues
- {any unresolved items}

## Recommendations
- {merge / needs more investigation / etc.}
```

## Error Handling

- **Push rejected** (branch protection, force push required): Report to user. Do NOT force push.
- **`/test` comment ignored by Prow**: User may lack `ok-to-test` permission. Check if the label exists on the PR: `gh pr view {pr} --json labels`.
- **CI timeout** (>150 min): Report timeout, check if the job is stuck. Suggest manual inspection.
- **Multiple CI jobs running**: Only track the latest run. Use the `detailsUrl` from the most recent check run.
- **Merge conflicts after push**: Report to user. The PR branch may need rebasing — do NOT rebase automatically.
- **Rate limiting on gh api**: GitHub allows 5000 requests/hour for authenticated users. Polling every 5 min = 12/hour, well within limits.

## Guardrails

- **Never force-push** — always additive commits
- **Never push to main** — only to the PR branch
- **Never edit source code** (`src/`) — only test infrastructure
- **Never close or merge the PR** — that's the user's decision
- **Max 3 `/test` comments per hour** — avoid spamming the PR
- **Always include the CI run URL** in commit messages for traceability
- **Stop on CODE_REGRESSION** — if the UI is genuinely broken, that's not a flaky test
