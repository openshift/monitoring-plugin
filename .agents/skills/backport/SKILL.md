---
name: backport
description: Backport a commit to an OpenShift or COO release branch while adapting dependencies and repository layout. Use when the user asks to backport a feature or fix.
---

# Backport a change

Require a target branch. Use the requested commit, or the current `HEAD` when none is supplied. Explicit invocation authorizes the branch creation and cherry-pick, but never a push or PR creation.

## Workflow

1. Inspect `git status`, the current branch, the source commit, and its changed files. Preserve unrelated work; stop if switching branches would overwrite it.
2. Confirm the target ref and source commit exist. Capture the source commit hash before switching branches.
3. Read the target branch's manifests and relevant source files with `git show`. Do not infer dependency versions solely from the branch name. Older branches may keep the frontend at the repository root rather than under `web/`.
4. Read [references/dependency-adaptations.md](references/dependency-adaptations.md) when the change touches frontend dependencies, routing, Console SDK APIs, or paths that differ between branches.
5. Create a descriptively named branch from the target and cherry-pick the source commit. Resolve conflicts and adapt the code to the target branch's actual APIs and layout.
6. Install dependencies only in the frontend directory used by the target branch. Do not delete an existing dependency directory unless troubleshooting requires it and the user approves.
7. Run checks appropriate to the changed files and available targets. Prefer the target branch's `Makefile` and package scripts over commands copied from the source branch.
8. Summarize the files changed, adaptations made, checks run, and any remaining failures. Provide push/PR commands if useful, but do not run them.

If the cherry-pick leaves unresolved conflicts, continue working through them. Abort only when the user asks or when preserving their work requires it.
