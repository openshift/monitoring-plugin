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
  - name: review-window
    description: "Seconds to wait for user feedback after posting fix to Slack before pushing (default: 0 = no wait). Requires Option B Slack setup."
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

### 3. Notifications & Review (optional)

Notifications and review are optional — if not configured, the script prints to stdout and the loop continues normally.

**Slack Notifications (one-way):**
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."
```
Setup: Slack → Apps → Incoming Webhooks → create webhook for your channel. 5 minutes.
Provides one-way status notifications at key events (ci_started, ci_failed, fix_applied, etc.).

**GitHub PR Comment Review (two-way):**

The `review-window` parameter enables a two-way review flow using GitHub PR comments. When a fix is ready:

1. Agent posts fix details as a PR comment (via `review-github.py post`)
2. Agent also sends a Slack webhook notification (if configured)
3. Agent waits `review-window` seconds for a reply from the **PR author only**
4. If the author replies on the PR — agent reads the feedback and adjusts the fix
5. If no reply within the window — agent proceeds autonomously

**Security**: Author filtering is **code-enforced** in `review-github.py` — only comments where `.user.login` matches the PR author are considered. This is deterministic, not instruction-based.

**How to reply**: Post a regular comment on the PR. The agent only reads comments from the PR author posted after the agent's notification. Optionally prefix with `/agent` for clarity.

No additional setup needed beyond `gh auth` (Step 1) — the same token used for `/test` comments is used for posting and reading review comments.

Both Slack webhook URL and review-window can be set in `cypress/export-env.sh` or `~/.zshrc`.

### 4. Unsigned Commits

Same as `/cypress:test-iteration:iterate-incident-tests` — all commits use `--no-gpg-sign`. They live on a PR branch and are squash-merged by the user.

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

Store this as `stability_context` — it will be passed to Diagnosis Agents in Step 7 to help them:
- Prioritize known-flaky tests (these are higher value to fix)
- Avoid re-attempting fixes that already failed in previous runs
- Distinguish new failures from recurring ones

### Step 3: Determine Current CI State

From the status check rollup, determine the state of the target job:

- **SUCCESS**: Skip to Step 8 (flakiness confirmation — was it truly stable?)
- **FAILURE**: Proceed to Step 6 (analyze the failure)
- **PENDING / IN_PROGRESS**: Skip to Step 5 (wait for it)
- **No run found**: Trigger one in Step 4

### Step 4: Trigger CI Run (if needed)

If there's no recent run, or a fix was just pushed:

```bash
gh api repos/openshift/monitoring-plugin/issues/{pr}/comments -f body="/test e2e-incidents"
```

**IMPORTANT**: The `/test` command uses the **short alias** (`e2e-incidents`), not the full Prow job name. Using the full name will fail with "specified target(s) for /test were not found."

Note: If you just pushed a commit in Step 7, the push automatically triggers Prow — you can skip the `/test` comment. Only use `/test` for:
- Retriggering without code changes (flakiness retry)
- The initial run if none exists

After triggering, notify and proceed to Step 5:
```bash
python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send ci_started "CI triggered for PR #{pr}. Polling for results (~2h)." --pr {pr} --branch {headRefName}
```

### Step 5: Wait for CI Completion

Use the polling script at `.claude/commands/cypress/test-iteration/scripts/poll-ci-status.py`:

```bash
python3 .claude/commands/cypress/test-iteration/scripts/poll-ci-status.py {pr}
```

Arguments: `<pr_number> [job_substring] [max_attempts] [interval_seconds]`
- Default job substring: `e2e-incidents`
- Default max attempts: 30 (150 minutes at 5-minute intervals)
- Default interval: 300 seconds

Run this with `run_in_background: true` and a timeout of 9000000ms (150 minutes).

When the background task completes, parse the output line starting with `CI_COMPLETE`:
- Extract `state` (SUCCESS or FAILURE)
- Extract `url` (Prow URL for the run)

### Step 6: Analyze CI Results

Convert the Prow URL to a gcsweb URL:
- Replace `https://prow.ci.openshift.org/view/gs/` with `https://gcsweb-ci.apps.ci.l2s4.p1.openshiftapps.com/gcs/`

Run `/cypress:test-iteration:analyze-ci-results` (or follow its instructions inline):

1. Fetch `started.json`, `finished.json`, `prowjob.json` for metadata
2. Fetch `build-log.txt` from the test artifacts path
3. List and fetch failure screenshots
4. Classify each failure

**Classification outcomes:**

| Classification | Action |
|---------------|--------|
| `INFRA_*` | Report to user. Optionally retrigger with `/retest` (Step 4). Do NOT attempt code fixes. |
| `TEST_BUG` | Diagnose and fix locally (Step 7) |
| `FIXTURE_ISSUE` | Diagnose and fix locally (Step 7) |
| `PAGE_OBJECT_GAP` | Diagnose and fix locally (Step 7) |
| `MOCK_ISSUE` | Diagnose and fix locally (Step 7) |
| `CODE_REGRESSION` | Report to user and **STOP** |

Notify after analysis:

If failures:
```bash
python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send ci_failed "{N} failures found: {test_names}. Diagnosing..." --pr {pr} --branch {headRefName} --url {ci_url}
```

If all green:
```bash
python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send ci_complete "All tests passed. Starting flakiness confirmation." --pr {pr} --branch {headRefName} --url {ci_url}
```

If `CODE_REGRESSION` or `INFRA_*` blocks the loop:
```bash
python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send blocked "{classification}: {description}. Agent stopped — needs human input." --pr {pr} --branch {headRefName}
```

If **all green** (SUCCESS): Proceed to Step 8 (flakiness confirmation).

### Step 7: Fix and Push

For each fixable failure:

1. **Diagnose** using `/cypress:test-iteration:diagnose-test-failure` (read screenshots, test code, fixtures, page object). Include `stability_context` from Step 2 — prior flakiness history helps distinguish new failures from recurring ones and avoids re-attempting previously failed fixes.
2. **Fix** — edit the relevant files. Same constraints as `/cypress:test-iteration:iterate-incident-tests`:
   - May edit: `cypress/e2e/incidents/**`, `cypress/fixtures/incident-scenarios/**`, `cypress/views/incidents-page.ts`, `cypress/support/incidents_prometheus_query_mocks/**`
   - Must NOT edit: `src/**`, non-incident tests, cypress config
3. **Validate locally** (optional but recommended if cluster is accessible):
   ```bash
   source cypress/export-env.sh && npx cypress run --spec "{SPEC}" --env grep="{TEST_NAME}"
   ```
4. **Commit**:
   ```bash
   git add {files}
   ```
   ```bash
   git commit --no-gpg-sign -m "fix(tests): {summary}

   CI run: {prow_url}
   Classifications: {list}

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
   ```

5. **Notify and review window** (before pushing):

   **a) Slack notification** (one-way, if configured):
   ```bash
   python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send fix_applied "*What changed:*\n• {file}: {change_description}\n\n*Why:* {diagnosis_summary}\n*Classification:* {classification} (confidence: {confidence})\n\n`git diff HEAD~1` on branch `{headRefName}`" --pr {pr} --branch {headRefName}
   ```

   **b) GitHub PR review comment** (two-way, if `review-window` > 0):

   Post fix details as a PR comment:
   ```bash
   python3 .claude/commands/cypress/test-iteration/scripts/review-github.py post {pr} "**What changed:**\n• {file}: {change_description}\n\n**Why:** {diagnosis_summary}\n**Classification:** {classification} (confidence: {confidence})\n\n\`git diff HEAD~1\` on branch \`{headRefName}\`"
   ```

   Capture `COMMENT_TIME` from the output, then wait for author reply:
   ```bash
   python3 .claude/commands/cypress/test-iteration/scripts/review-github.py wait {pr} {COMMENT_TIME} --timeout {review-window}
   ```

   Parse the output:
   - `REPLY=<text>`: PR author provided feedback. Read the reply text and adjust the fix accordingly. This may mean:
     - Reverting the commit (`git reset --soft HEAD~1`), applying the user's suggestion, and re-committing
     - Or making an additional commit on top with the adjustment
   - `NO_REPLY`: No feedback within the window. Proceed with push.

   **Note**: The `wait` command only considers comments from the PR author (`.user.login` match, code-enforced). Comments from other users or bots are ignored.

6. **Push**:
   ```bash
   git push origin {headRefName}
   ```

The push automatically triggers a new Prow run. Go to **Step 5** (wait for CI).

Track iteration count. If `current_iteration >= max-iterations`: Report remaining failures and **STOP**.

### Step 8: Flakiness Confirmation

A single green CI run doesn't prove stability. Trigger `confirm-runs` additional runs (default: 2) to confirm.

For each confirmation run:

1. Trigger via `/test` comment (no code changes):
   ```bash
   gh api repos/openshift/monitoring-plugin/issues/{pr}/comments -f body="/test e2e-incidents"
   ```

2. Wait for completion (Step 5)

3. Analyze results (Step 6)

4. If failures found:
   - If same test fails across runs → likely a real bug, diagnose and fix (Step 7)
   - If different tests fail across runs → environment-dependent flakiness, harder to fix
   - Report flakiness pattern to user

Track results across all runs:
```
Stability Report:
  Run 1 (fix iteration): {SHA} — PASSED
  Run 2 (confirm #1):    {SHA} — PASSED
  Run 3 (confirm #2):    {SHA} — PASSED (or FAILED: test X)
```

### Step 9: Final Report

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

After generating the report, send the final notification:
```bash
python3 .claude/commands/cypress/test-iteration/scripts/notify-slack.py send iteration_done "Iteration complete: {passed}/{total} passed, {flaky} flaky, {iterations} cycles.\n\n{short_summary}" --pr {pr} --branch {headRefName}
```

### Step 10: Update Stability Ledger

After the final report, update `web/cypress/reports/test-stability.md`.

Read the file and update both sections:

**1. Current Status table** — for each test in this run:
- If test already in table: update pass rate, update trend
- If test is new: add a row
- Pass rate = total passes / total runs across all recorded iterations
- Trend: compare last 3 runs — improving / stable / degrading

**2. Run History log** — append a new row:
```
| {next_number} | {YYYY-MM-DD} | ci | {branch} | {total_tests} | {passed} | {failed} | {flaky} | {commit_sha} |
```

**3. Machine-readable data** — update the JSON block between `STABILITY_DATA_START` and `STABILITY_DATA_END` with the new run data.

Commit:
```bash
git add web/cypress/reports/test-stability.md
```
```bash
git commit --no-gpg-sign -m "docs: update test stability ledger — {passed}/{total} passed, {flaky} flaky (CI)"
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
