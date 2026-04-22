---
description: Consolidate one or more agentic test iteration branches into a clean, shippable fix branch — analyzes overlaps, merges intelligently, verifies with flakiness probing, and pushes
parameters:
  - name: branch-name
    description: "Target branch name (e.g. test/OBSINTA-1290-incident-stability). Created from main."
    required: true
    type: string
  - name: source-branches
    description: "Comma-separated list of iteration branch names or a glob (e.g. 'FIX-PROPOSAL-AGENTIC/*' or 'branch-a,branch-b,branch-c'). Fetched from origin."
    required: true
    type: string
  - name: flakiness-runs
    description: "Number of flakiness probe runs after fixes are applied (default: 3)"
    required: false
    type: string
  - name: test-target
    description: "Cypress test target — 'all', 'regression', a spec file, or grepTags pattern (default: all)"
    required: false
    type: string
---

# Productize Agentic Test Iterations

Consolidate one or more agentic iteration branches into a single clean, shippable branch.
When multiple branches exist, analyze whether their changes are complementary, redundant,
or conflicting — then merge them intelligently rather than blindly stacking cherry-picks.

## Prerequisites

- `web/cypress/export-env.sh` must exist with cluster credentials.
  If missing, create it from cluster credentials in the conversation (do NOT run `/cypress:setup`).
- Node modules installed in `web/` (`npm install`).

## Step 1: Discover and Fetch Source Branches

Parse `$2` (source-branches):
- If it contains `*`, treat as a glob: `git ls-remote origin | grep <pattern>`
- If comma-separated, split into a list

Fetch all source branches as remote tracking refs:
```bash
git fetch origin "<branch>:refs/remotes/origin/<branch>"
```

If any source branch has an overview/index document (e.g. `docs/agentic-fix-proposals.md`),
read it first — it may describe the branches and their relationships.

Report what was found:
```
Found N source branches:
  - origin/<branch-1> — N commits above main
  - origin/<branch-2> — N commits above main
```

## Step 2: Analyze Each Branch

For each source branch, extract:

1. **Commits above main**: `git log origin/main..<branch> --oneline`
2. **Files changed**: `git diff origin/main..<branch> --stat`
3. **Commit messages and descriptions**: Read each commit message for intent

Build a structured summary per branch:
```
Branch: <name>
Origin: <how it was created — CI loop, local sandbox, manual>
Commits: N
Files touched: <list>
What it fixes:
  - <description of each fix with classification>
```

## Step 3: Evaluate Overlaps

This is the critical step. For each pair of branches that touch the **same file**:

1. **Read both versions** of the overlapping file
2. **Identify the relationship**:
   - **Complementary**: Different fixes to different parts of the same file (both needed)
   - **Progressive**: One branch's changes are a superset of another's (keep the latest)
   - **Redundant**: Both branches solve the same problem differently (pick the better one)
   - **Conflicting**: Changes that are incompatible (requires manual resolution)
3. **Decide the merge strategy** for each overlap

Also check for cross-file dependencies:
- Does branch A add a function that branch B calls?
- Does branch A change a signature that branch B depends on?

**Critical: Check git history for reverted patterns.** For each changed file, run
`git log origin/main -- <file>` and read recent commit messages. Look for
patterns where a prior commit explicitly removed or replaced something that the
iteration branch is re-introducing. Common examples:
- `cy.reload()` removed in favor of SPA navigation (dynamic plugin chunk loading
  breaks on full page reload)
- Flattened selectors replaced with grouped selectors
- Timeouts adjusted for a specific reason

If an iteration branch re-introduces a pattern that was previously removed, flag
it as **REGRESSIVE** and investigate whether the original removal reason still
applies. The iteration agent doesn't have git history context and will often
re-discover a "fix" that was already tried and reverted.

Produce an evaluation report:
```
## Overlap Analysis

### <file-path>
Touched by: branch-1, branch-3
Relationship: COMPLEMENTARY
Strategy: Apply both — they modify different sections

### <file-path>
Touched by: branch-1, branch-2
Relationship: PROGRESSIVE
Strategy: Take branch-2 only — it's a superset
```

**Present this evaluation to the user and wait for confirmation before proceeding.**

## Step 4: Create Clean Branch

```bash
git checkout -b $1 origin/main
```

If the branch already exists, ask the user whether to overwrite or append a suffix.

## Step 5: Apply Changes

Based on the evaluation from Step 3, apply changes in logical order.

**Do NOT blindly cherry-pick individual commits.** Instead:

1. For **progressive** overlaps: only apply the most complete version
2. For **redundant** overlaps: apply the one chosen in Step 3
3. For **complementary** changes: apply in dependency order (e.g., page object before tests that use it)
4. For **conflicts**: manually merge, reading both versions and combining intent
5. For **regressive** changes: drop them entirely and note why in the commit message

After applying each logical group:
- Run `npx prettier --write <changed-files>` immediately
- Run `npx eslint --fix <changed-files>`
- Check for remaining lint errors with `npx eslint <changed-files>`
- Fix any remaining max-len or formatting issues manually

**Do not defer lint fixes to a separate commit.** Each commit must pass the pre-commit hook.

## Step 6: Structure Commits by Logical Concern

Group changes into commits by **what problem they solve**, not by which branch they came from.
Good commit groupings:
- One commit per distinct fix category (OOM prevention, plugin warm-up, test hygiene, etc.)
- Page object changes bundled with the test changes that use them
- Fixture additions bundled with the tests that reference them

Bad commit groupings:
- One commit per source branch (archaeology, not intent)
- Intermediate steps that are immediately superseded
- Separate "fix lint" commits

Commit message format:
```
fix(tests): <summary of what problem this solves>

<description of the approach and why>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Use `--no-gpg-sign` for all commits (sandbox environment).

### Page object cleanup

After structuring commits, if any page object files were modified (e.g.
`incidents-page.ts`), run `/cypress:test-iteration:refactor-page-object` on
them. Iteration branches often introduce raw selectors, duplicated patterns,
and inline constants that should be consolidated before shipping.

## Step 7: Run Verification

### 7a: Resolve test target

Based on `$4` (test-target, default: `all`):

| Target | Spec | Grep Tags |
|--------|------|-----------|
| `all` | `cypress/e2e/incidents/**/*.cy.ts` | `@incidents --@e2e-real --@xfail --@demo` |
| `regression` | `cypress/e2e/incidents/regression/**/*.cy.ts` | `@incidents --@e2e-real --@xfail` |
| specific file | `cypress/e2e/incidents/{target}` | (none) |

### 7b: Run tests once

From `web/`:
```bash
bash scripts/clean-test-artifacts.sh
source cypress/export-env.sh && node --max-old-space-size=4096 \
  ./node_modules/.bin/cypress run --browser electron \
  --spec "{SPEC}" --env grepTags="{GREP_TAGS}"
```

If there are failures, diagnose using `/cypress:test-iteration:diagnose-test-failure`.
Apply fixes and re-run. Max 2 retries per test.

### 7c: Run e2e-real (if cluster available)

If `web/cypress/export-env.sh` has cluster credentials and the cluster is reachable:
```bash
source cypress/export-env.sh && node --max-old-space-size=4096 \
  ./node_modules/.bin/cypress run --browser electron \
  --spec "cypress/e2e/incidents/00.coo_incidents_e2e.cy.ts"
```

This test takes 10-25 minutes. Run in background.
If it fails, diagnose the failure — it may reveal issues the regression suite doesn't cover.

### 7d: Flakiness probe

Run the test target `$3` times (default: 3). For each run:
1. Clean artifacts
2. Run tests
3. Record per-test pass/fail

Compute flakiness:
```
Flakiness Report:
  Total tests: N
  Stable (all runs passed): N
  Flaky (some runs failed): N
  Broken (all runs failed): N
```

If any flaky tests are found, diagnose and fix them. Re-run the probe on fixed tests.

## Step 8: Present Results and Confirm Push

Present the final state to the user:
```
# Ready to Push

## Branch: $1
## Commits: N

| # | SHA | Description |
|---|-----|-------------|

## Verification
- Regression: N/N passed, N runs, 0 flaky
- e2e-real: passed / skipped / failed
- Files changed: N

## Excluded from this branch
- <list any process artifacts, docs, ledgers not included>
```

**Wait for user confirmation before pushing.**

## Step 9: Push

```bash
git push origin $1
```

If the push fails due to auth, try HTTPS with `gh auth token`:
```bash
git remote set-url origin https://$(gh auth token)@github.com/<owner>/<repo>.git
git push origin $1
```

Report the push result and suggest PR creation if desired.

## Error Handling

- **Lint failures after cherry-pick**: Run prettier + eslint --fix first. If max-len errors
  remain, shorten log messages or wrap comments. Never create a separate "fix lint" commit.
- **Cherry-pick conflicts**: Read both sides, understand intent, merge manually. Never use
  `--ours` or `--theirs` without understanding what's being dropped.
- **Test failures after merge**: Diagnose with `/cypress:test-iteration:diagnose-test-failure`.
  If the failure is caused by the merge (not a pre-existing issue), fix it before proceeding.
- **Cypress crashes**: Check `--max-old-space-size`, missing deps, or config issues.
- **No Chrome**: Use `--browser electron` as fallback.

## Guardrails

- **Never edit source code** (`src/`) — only test files, page objects, fixtures
- **Never disable tests** — no `.skip()`, no adding `@flaky` tags
- **Never push without user confirmation**
- **Never include process artifacts** (iteration docs, stability ledgers) in the output branch
  unless the user explicitly asks
- **Preserve commit authorship** where possible — use the original author from cherry-picks
