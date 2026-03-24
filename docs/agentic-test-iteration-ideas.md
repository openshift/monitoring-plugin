# Agentic Test Iteration — Ideas & Future Improvements

Ideas and potential enhancements for the agentic test iteration system. These are not committed plans — they're options to explore when the core workflow is stable.

## Authentication: GitHub App for CI Triggering

**Problem**: The CI iteration skill (`/iterate-ci-flaky`) needs to comment `/test` on upstream PRs to trigger Prow. Current options (PATs, OAuth) are tied to a personal GitHub account.

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
1. **Phase A** (`/iterate-incident-tests`): Fast local iteration with mocks — fix all mock-testable issues
2. **Phase B** (`/iterate-ci-flaky`): Push to CI — catch environment-specific flakiness

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

**Status**: Partially implemented. Ledger file created at `web/cypress/reports/test-stability.md`. Update step added to `/iterate-incident-tests` (Step 14). Still needs to be wired into `/iterate-ci-flaky`.

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

**Problem**: The CI iteration loop (`/iterate-ci-flaky`) runs for hours (each CI run takes ~2h). The user has no visibility into what the agent is doing until the session ends. By then, multiple fix-push-wait cycles may have happened with no chance for the user to intervene.

**Idea**: Optional Slack notifications at key moments, giving the user a chance to review and influence the next cycle.

### Notification Events

| Event | When | Why the user cares |
|-------|------|-------------------|
| `fix_applied` | After committing and pushing a fix | User can review the diff before CI runs. Can reply "redo" or "don't change X" to influence next cycle |
| `ci_started` | After triggering `/test` or push | Confirmation that the loop is progressing |
| `ci_complete` | CI run finished (pass or fail) | User knows whether to check in or let it continue |
| `review_needed` | 5-commit threshold reached or blocking issue | User needs to act |
| `flaky_found` | Intermittent failure detected | User may have context about why |
| `blocked` | Agent stopped — REAL_REGRESSION, infra issue, or auth problem | Needs human input to continue |
| `iteration_done` | Full loop complete with summary | Final status |

### Implementation Options

**Option A: Slack Incoming Webhook** (simplest)
- User creates a webhook for their channel: Slack → Apps → Incoming Webhooks
- Set `SLACK_WEBHOOK_URL` in `export-env.sh` or shell environment
- Agent calls `curl -X POST -H 'Content-type: application/json' -d '{"text":"..."}' $SLACK_WEBHOOK_URL`
- Pro: No Slack app needed, 5-minute setup
- Con: One-way — user can't reply to the agent via Slack

**Option B: Slack Bot with interactive messages**
- A proper Slack app with bot token
- Sends messages with action buttons: "Approve", "Redo", "Stop"
- User clicks a button, webhook fires back to the agent
- Pro: Two-way interaction without leaving Slack
- Con: Needs a server to receive button callbacks. Possible with a lightweight service or ngrok tunnel

**Option C: Claude Code hooks**
- Use Claude Code's hook system to trigger notifications on specific events (tool calls, commits)
- Pro: Native to Claude Code, no external service
- Con: Hooks are local — would need forwarding to Slack

### Recommended Approach

Start with **Option A** (webhook). It's 5 minutes to set up and covers the primary need: visibility into what the agent is doing. The agent posts, the user reads. If the user wants to intervene, they message the agent directly in the Claude Code session.

The `notify-slack.py` script would:
- Check if `SLACK_WEBHOOK_URL` is set — if not, skip silently (notifications are optional)
- Format messages with Slack Block Kit (sections, context with PR link, branch, CI URL)
- Be called by both skills at key points in the loop

### Configuration

Add to `cypress/export-env.sh`:
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."
```

Or set globally in `~/.zshrc` if preferred.

### Message Format Example

```
:wrench: Agent: Fix Applied

Fixed selector timeout in filtering test — `.severity-filter` →
`[data-test="severity-filter"]`. Pushed to `test/incident-robustness-2026-03-24`.

CI will run automatically. Reply in the agent session if you want to
change approach before next cycle.

PR #860 | Branch: agentic-test-iteration | CI Run
```
