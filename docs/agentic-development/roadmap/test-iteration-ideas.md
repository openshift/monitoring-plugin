# Agentic Test Iteration — Ideas & Future Improvements

Ideas and potential enhancements for the agentic test iteration system. These are not committed plans — they're options to explore when the core workflow is stable.

## Authentication: GitHub App for CI Triggering

**Problem**: The CI iteration skill (`/cypress:test-iteration:iterate-ci-flaky`) needs to comment `/test` on upstream PRs to trigger Prow. Current options (PATs, OAuth) are tied to a personal GitHub account.

**Idea**: Create a dedicated GitHub App installed on `openshift/monitoring-plugin`.

### How it would work

1. Create a GitHub App with minimal permissions: `Issues: Write`, `Pull requests: Read`, `Checks: Read`
2. An org admin approves installation on `openshift/monitoring-plugin`
3. The app authenticates via a private key (`.pem` file) → short-lived installation tokens (1h expiry, auto-rotated)
4. Comments appear as `my-ci-bot[bot]` instead of a personal user

### Tradeoffs vs OAuth

| Aspect | OAuth (`gh auth login --web`) | GitHub App |
|--------|-------------------------------|------------|
| Setup effort | Minimal | Moderate (create app, org admin approval) |
| Tied to a person | Yes | No — bot identity |
| Survives user leaving org | No | Yes |
| Token management | Manual refresh | Automatic (1h expiry from private key) |
| Audit trail | Personal user | Dedicated bot account |
| Team sharing | Each person needs own auth | One app, anyone's agent can use it |

### When to pursue

- When multiple team members want to use the CI iteration skill
- When you want a persistent bot identity for test automation comments
- When you want to remove personal account dependency

### Blocker

Requires an `openshift` org admin to approve the app installation.

---

## CI Iteration: Fully Automated Job Triggering

**Problem**: Currently the CI loop requires either a `/test` comment (needs upstream write access) or a `git push` (triggers automatically). The push path works but creates noise commits.

**Ideas**:
- **Empty commits**: `git commit --allow-empty -m "retrigger CI"` — triggers Prow without code changes, but pollutes history
- **Prow API**: Prow may have a direct API for retriggering jobs without GitHub comments — investigate `https://prow.ci.openshift.org/` endpoints
- **GitHub Actions bridge**: A lightweight GitHub Action on the fork that comments `/test` on the upstream PR when triggered via `workflow_dispatch`

---

## Parallel CI Runs for Flakiness Detection

**Problem**: Flakiness probing requires N sequential CI runs (~2h each). 3 runs = 6 hours.

**Idea**: Open N temporary PRs from the same branch, each triggers its own CI run in parallel. Collect all results, then close the temporary PRs.

**Tradeoff**: Consumes N times the CI resources. May not be acceptable for shared CI infrastructure.

**Alternative**: Ask if Prow supports multiple runs of the same job on the same PR — some CI systems allow this.

---

## Local Mock Tests + CI Real Tests as Two-Phase Validation

**Problem**: Local iteration is fast but uses mocked data. CI uses real clusters but is slow (~2h).

**Idea**: Formalize a two-phase approach:
1. **Phase A** (`/cypress:test-iteration:iterate-incident-tests`): Fast local iteration with mocks — fix all mock-testable issues
2. **Phase B** (`/cypress:test-iteration:iterate-ci-flaky`): Push to CI — catch environment-specific flakiness

The orchestrator could automatically transition from Phase A to Phase B when local tests are green.

---

## Agent Fork with Deploy Key

**Problem**: The agent creates unsigned commits on the user's working branch. Push access, GPG signing, and branch management all create friction.

**Idea**: A dedicated fork (`monitoring-plugin-agent` or similar) with:
- A passwordless deploy key for push access
- No GPG signing requirement
- Agent creates PRs from the fork to the upstream repo
- User reviews and merges — clean separation of human vs agent work

**Benefits**:
- No unsigned commits in the user's fork
- Agent can push freely without SSH key access to user's account
- Clear audit trail: all agent work comes from the agent fork
- Multiple agents (different team members) can share the same fork

---

## Screenshot Diffing for Visual Regression

**Problem**: The diagnosis agent reads failure screenshots to understand UI state, but has no reference for "what it should look like."

**Idea**: Capture baseline screenshots from passing tests and store them. On failure, the agent can compare the failure screenshot against the baseline to identify visual differences.

**Implementation**: Cypress has plugins for visual regression testing (`cypress-image-snapshot`). The agent could:
1. Generate baselines from a known-good run
2. On failure, diff the failure screenshot against baseline
3. Highlight visual changes to speed up diagnosis

---

  ## Test Stability Ledger

  **Status**: Partially implemented. Ledger file created at `web/cypress/reports/test-stability.md`. Update step added to `/cypress:test-iteration:iterate-incident-tests` (Step 14). Still needs to be wired into `/cypress:test-iteration:iterate-ci-flaky`.

  **Problem**: Flakiness data is ephemeral — it exists in the agent's report from one run and is lost. Next time the agent runs, it has no memory of previous results.

  **Design**: A markdown file with embedded machine-readable JSON, updated by both skills after each run.

  **Location**: `web/cypress/reports/test-stability.md` — committed to the working branch, travels with the fixes.

  **Contents**:
  - Human-readable table: per-test pass rate, trend, last failure reason, fix commit
  - Run history log: date, type (local/CI), branch, pass/fail counts
  - Machine-readable JSON block for programmatic parsing by the agent

  **Agent behavior**:
  - Reads the ledger at the start of each run to prioritize — "this test was flaky in last 3 runs, focus here"
  - Updates the ledger after each run with new results
  - Commits the ledger update alongside fixes

  ---

## Slack Notifications for Long-Running Loops

**Status**: Implemented. Slack webhook notifications (Option A) integrated into `/cypress:test-iteration:iterate-ci-flaky`. GitHub PR comment-based review flow implemented as the two-way interaction channel (`review-github.py`). Option B (Slack bot with thread replies) documented but deprioritized due to internal setup complexity.

### The Problem

The CI iteration loop (`/cypress:test-iteration:iterate-ci-flaky`) runs for hours — each CI run takes ~2h, and the loop may do 3-5 fix-push-wait cycles. During that time:

- The user has no visibility into what the agent decided to fix or how
- By the time the loop finishes, multiple commits may have been pushed with no chance to course-correct
- A wrong fix in cycle 1 wastes 2+ hours of CI time before the agent discovers it didn't work
- The user may have domain context ("that test is flaky because of animation timing, not the selector") that would save cycles

The core tension: **autonomy vs oversight**. The agent should run independently, but the user needs the ability to intervene at natural pause points.

### Natural Pause Points

The CI loop has built-in pauses where user input is most valuable:

```
Push fix ──→ [PAUSE: fix_applied] ──→ CI runs (~2h) ──→ [PAUSE: ci_complete] ──→ Analyze ──→ ...
```

1. **After fix, before CI runs** (`fix_applied`): The agent committed a fix and is about to push (or just pushed). This is the highest-value notification — the user can review the approach and say "redo" before a 2-hour CI cycle starts.

2. **After CI completes** (`ci_complete`): Results are in. The agent is about to diagnose. User might have context about known issues.

3. **When blocked** (`blocked`): Agent can't continue — needs human decision.

### Review Window

For the `fix_applied` event, the agent could optionally **wait before pushing**, giving the user a time window to respond:

```
Agent: "I'm about to push this fix. Waiting 10 minutes for feedback before proceeding."
       [Shows diff summary in Slack]

User (within 10 min): "Don't change the selector, the issue is timing. Add a cy.wait(500) instead."

Agent: Reverts fix, applies user's suggestion, pushes that instead.
```

Or if no response within the window, the agent proceeds autonomously.

Configuration: `review-window=10m` parameter on `/cypress:test-iteration:iterate-ci-flaky`. Set to `0` for fully autonomous (no waiting).

### Notification Content — What Makes Each Message Actionable

**`fix_applied`** — the most important notification:
```
:wrench: Agent: Fix Applied

*What changed:*
• `cypress/views/incidents-page.ts:45` — selector `.severity-filter` → `[data-test="severity-filter"]`
• `cypress/e2e/incidents/regression/01.reg_filtering.cy.ts:78` — added `.should('exist')` guard before click

*Why:* Screenshot showed the filter dropdown existed but had a different class. The `data-test` attribute is stable across builds.

*Classification:* PAGE_OBJECT_GAP (confidence: HIGH)

*Diff:* `git diff HEAD~1` on branch `test/incident-robustness-2026-03-24`

*Next:* CI will trigger automatically on push. Reply in the agent session to change approach.

PR #860 | Branch: test/incident-robustness-2026-03-24
```

The key: show **what** changed, **why** the agent chose that fix, and **how confident** it is. This lets the user quickly decide "looks good, let it run" vs "wrong approach, let me intervene."

**`ci_complete`** — actionable status:
```
:white_check_mark: Agent: CI Complete — PASSED (run 2/5)

*Results:* 15/15 tests passed in 1h 47m
*Flakiness probe:* 2 of 5 confirmation runs complete, all green so far

*Next:* Triggering confirmation run 3. No action needed.

PR #860 | Branch: test/incident-robustness-2026-03-24 | CI Run
```

Or on failure:
```
:x: Agent: CI Complete — FAILED (iteration 2/3)

*Results:* 13/15 passed, 2 failed
*Failures:*
• "should filter by severity" — Timed out on `[data-test="severity-chip"]` (same as last run)
• "should display chart bars" — new failure, `Expected 5 bars, found 0`

*Assessment:*
• severity filter: same fix didn't work, will try different approach
• chart bars: new failure — possibly caused by previous fix (will investigate)

*Next:* Diagnosing and fixing. Will notify before pushing.

PR #860 | Branch: test/incident-robustness-2026-03-24 | CI Run
```

**`blocked`** — requires user action:
```
:octagonal_sign: Agent: Blocked — REAL_REGRESSION

*Test:* "should display incident bars in chart"
*Issue:* Chart component renders empty. Screenshot shows the chart area with no bars, no error, no loading state.
*Commit correlation:* `src/components/incidents/IncidentChart.tsx` was modified in this PR (+45, -12)

*This is not a test issue* — the chart rendering logic appears broken. Agent cannot fix source code in Phase 1.

*Action needed:* Investigate the chart component refactor. Agent will stop iterating on this test.

PR #860 | Branch: test/incident-robustness-2026-03-24
```

### Implementation Options

**Option A: Slack Incoming Webhook** (recommended starting point)
- Setup: Slack → Apps → Incoming Webhooks → create webhook for your channel. 5 minutes.
- Set `SLACK_WEBHOOK_URL` in `export-env.sh` or `~/.zshrc`
- Agent posts via `curl` in a standalone `notify-slack.py` script
- Messages formatted with Slack Block Kit (sections, context, code blocks)
- Pro: No Slack app, no server, no OAuth. Just a URL.
- Con: One-way — user sees notifications but must respond in the Claude Code session, not in Slack

**Option B: Slack Bot with thread-based interaction** (no callback server needed)
- Create a Slack App with bot token (`chat:write`, `channels:history`)
- Agent posts messages to a channel, capturing the message `ts` (timestamp/ID)
- Before proceeding at pause points, agent **reads thread replies** via `conversations.replies` API
- If user replied in the Slack thread → agent reads the reply and adjusts
- If no reply within the review window → agent proceeds

```
Agent posts:  "Fix applied. Reply in this thread to change approach. Proceeding in 10 min."
User replies: "Use data-test attributes instead of class selectors"
Agent reads:  conversations.replies → sees user feedback → adjusts fix
```

- Pro: Two-way interaction without a callback server. User stays in Slack.
- Con: Needs a Slack App (not just a webhook). Polling for replies adds complexity. Bot token needs to be stored securely.

**Implementation sketch for Option B:**
```python
# Post notification and get message timestamp
response = slack_client.chat_postMessage(channel=CHANNEL, blocks=blocks)
message_ts = response["ts"]

# Wait for review window, polling for replies
deadline = time.time() + review_window_seconds
while time.time() < deadline:
    replies = slack_client.conversations_replies(channel=CHANNEL, ts=message_ts)
    user_replies = [r for r in replies["messages"] if r.get("user") != BOT_USER_ID]
    if user_replies:
        return user_replies[-1]["text"]  # Return latest user feedback
    time.sleep(30)

return None  # No feedback, proceed autonomously
```

**Option C: Claude Code hooks → Slack bridge**
- Configure a Claude Code hook that fires on `git commit` or specific tool calls
- The hook runs a shell script that posts to Slack
- Pro: Zero changes to the skills — hooks are external
- Con: Less control over notification content and timing. Can't implement review windows. Hooks are local config, not portable.

**Option D: GitHub PR comments as notification channel**
- Instead of Slack, the agent posts status updates as PR comments
- User replies directly on the PR
- Agent reads PR comments via `gh api` before proceeding
- Pro: No Slack setup at all. Everything stays in GitHub. Natural for code review context.
- Con: Noisier PR history. Not real-time (no push notifications unless GitHub notifications are configured).

### Recommended Progression

1. **Start with Option A** — get visibility. User monitors passively, intervenes in Claude Code session when needed.
2. **Upgrade to Option B** when the review window pattern proves valuable — adds two-way interaction within Slack.
3. **Option D** is a good alternative if you prefer keeping everything in GitHub — especially for team use where the PR is the natural communication hub.

### Configuration

```bash
# Option A: Webhook only (one-way)
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."

# Option B: Bot with thread interaction (two-way)
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_CHANNEL_ID="C0123456789"
export SLACK_REVIEW_WINDOW="600"  # seconds to wait for feedback (0 = no wait)
```

### Skill Integration Points

Where notifications fire in each skill:

**`/cypress:test-iteration:iterate-ci-flaky`:**
- Step 3: `ci_started` — after `/test` comment or push
- Step 5: `ci_complete` — after CI analysis
- Step 6: `fix_applied` — after committing fix, before push (with optional review window)
- Step 7: `flaky_found` — when flakiness detected in confirmation runs
- Step 8: `iteration_done` — final summary
- Any step: `blocked` — on REAL_REGRESSION, INFRA_ISSUE, auth failure

**`/cypress:test-iteration:iterate-incident-tests`:**
- Step 10: `fix_applied` — after committing batch (less critical since local runs are fast)
- Step 12: `flaky_found` — during flakiness probe
- Step 13: `iteration_done` — final summary
- Any step: `blocked` — on REAL_REGRESSION

---

## Cloud Execution: Long-Running Autonomous Agent

**Problem**: The current setup requires a local machine with an active Claude Code CLI session. Long CI polling (~2h per run) causes session timeouts, and the user must keep a terminal open.

### Option 1: Claude Code Headless Mode (simplest)

Run Claude Code non-interactively without a TTY:

```bash
claude --print --dangerously-skip-permissions \
  -p "/cypress:test-iteration:iterate-ci-flaky pr=860 confirm-runs=5"
```

- `--print` / `-p`: non-interactive, outputs result and exits
- `--dangerously-skip-permissions`: skips all approval prompts (use only in sandboxed environments)
- Can run in `tmux`, `nohup`, GitHub Actions, or any CI runner
- Uses the same tools, skills, and CLAUDE.md as interactive mode
- Limitation: single-shot execution — runs the prompt and exits

**Deployment**: `nohup claude --print ... > output.log 2>&1 &` on any machine, or in a GitHub Actions runner.

### Option 2: Claude Agent SDK (most flexible)

The Agent SDK (`@anthropic-ai/claude-code`) is a Node.js/TypeScript library that embeds Claude Code as a programmable agent:

```typescript
import { Claude } from "@anthropic-ai/claude-code";

const claude = new Claude({
  dangerouslySkipPermissions: true,
});

const result = await claude.message({
  prompt: "/cypress:test-iteration:iterate-ci-flaky pr=860 confirm-runs=5",
  workingDirectory: "/path/to/monitoring-plugin",
});

// Post result as PR comment
await octokit.issues.createComment({
  owner: "openshift", repo: "monitoring-plugin",
  issue_number: 860, body: result.text,
});
```

#### SDK vs CLI comparison

| Aspect | CLI (`claude`) | Agent SDK |
|--------|---------------|-----------|
| Runtime | Terminal process | Node.js library |
| Lifecycle | Single session, exits | Embed in any long-lived process |
| Event-driven | No | Yes — webhooks, timers, PR events |
| Permissions | Interactive prompts or skip-all | Programmatic control |
| Tools | Built-in (Read, Write, Bash, etc.) | Same built-in + custom tools |
| State | Session-scoped | Persistent (DB, files, etc.) |
| Deployment | Local terminal | Anywhere Node.js runs |

#### Requirements to port current skills

- Node.js runtime with `@anthropic-ai/claude-code`
- `ANTHROPIC_API_KEY` environment variable
- `gh` CLI authenticated (or GitHub App token for comment access)
- Git + SSH for pushing to fork
- The repo cloned in the agent's working directory
- All skill files (`.claude/commands/`) present in the clone

#### What stays the same

- Skills (`.md` files) — the SDK reads them from `.claude/commands/`
- Polling script (`poll-ci-status.py`) — SDK runs Bash the same way
- `/cypress:test-iteration:diagnose-test-failure`, `/cypress:test-iteration:analyze-ci-results` — all work as-is
- File editing, git operations, Cypress execution — identical

#### What changes

- No permission prompts — `dangerouslySkipPermissions` in a sandboxed container
- State between runs — persist to file or DB instead of ephemeral session
- Triggering — webhook handler calls the SDK instead of user typing a command
- Error recovery — the wrapping process can catch failures and retry

### Option 3: GitHub Actions Workflow (cloud, event-driven)

A GitHub Actions workflow that runs the agent on PR events:

```yaml
name: Flaky Test Iteration
on:
  issue_comment:
    types: [created]

jobs:
  iterate:
    if: contains(github.event.comment.body, '/run-flaky-iteration')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      - name: Run iteration
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          claude --print --dangerously-skip-permissions \
            -p "/cypress:test-iteration:iterate-ci-flaky pr=${{ github.event.issue.number }} confirm-runs=3"
      - name: Post results
        run: gh pr comment ${{ github.event.issue.number }} --body-file output.md
```

**Flow**:
1. User comments `/run-flaky-iteration` on a PR
2. GitHub Actions triggers the workflow
3. Claude Code runs in headless mode on the Actions runner
4. Agent executes the full iteration loop (trigger CI, wait, analyze, fix, push)
5. Results posted back as a PR comment

**Considerations**:
- GitHub Actions runners have a 6h timeout — enough for 2-3 CI runs
- Needs `ANTHROPIC_API_KEY` and `GH_TOKEN` as repository secrets
- Runner needs SSH key for git push (or use `GH_TOKEN` with HTTPS)
- Cost: API tokens consumed + GitHub Actions minutes

### Recommendation

1. **Start with headless mode** (`tmux` + `--print`) to validate the flow works without interactive prompts
2. **Move to GitHub Actions** for true cloud execution — event-driven, no local machine needed
3. **Agent SDK** when you want a custom orchestrator with richer state management, error recovery, or Slack integration beyond what the skills provide
