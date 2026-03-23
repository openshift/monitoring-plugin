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

## Test Stability Dashboard

**Problem**: Flakiness data is ephemeral — it exists in the agent's report from one run and is lost.

**Idea**: Persist test stability data across runs in a simple format (CSV, JSON, or markdown table). Track:
- Test name, last N run results, flakiness rate, last failure date, last fix commit
- Trend over time: is the test getting more or less stable?

Could be a file in the repo (`docs/test-stability.md`) updated by the agent after each iteration.
