---
name: diagnose-pipeline-failure
description: Diagnose a failed Prow/CI job (periodic or presubmit) for this repository, then report the cause and, when it is in this repository, leave a minimal uncommitted fix for review. Use when the user pastes a prow.ci.openshift.org or storage.googleapis.com logs URL, or asks why a periodic/CI job is failing.
---

# Diagnose a pipeline failure

Every run ends in a report. When the cause lives in this repository, also leave a fix as uncommitted
changes in the working tree for the user to review — never commit, push, or open a PR.

## 1. Get the log — never reuse the signed URL

Inputs are usually one of:

- `https://prow.ci.openshift.org/view/gs/test-platform-results-public/logs/<job>/<run-id>` (periodic)
- `https://prow.ci.openshift.org/view/gs/test-platform-results-public/pr-logs/pull/<org_repo>/<pr>/<job>/<run-id>` (presubmit)
- `https://storage.googleapis.com/test-platform-results-public/logs/<job>/<run-id>/build-log.txt?Expires=…&Signature=…`

Signed links expire, and an expired one is a ~220-byte XML body (`<Code>ExpiredToken</Code>`) that looks
like a log file but contains no test output. Drop the query string — the bucket is public:

```bash
node .agents/skills/diagnose-pipeline-failure/scripts/prow-logs.mjs report '<url>'
node .agents/skills/diagnose-pipeline-failure/scripts/prow-logs.mjs report <job-name> <run-id> [--history N]
```

Quote the URL — signed links contain `&`, which the shell would otherwise treat as a command separator.
A URL carries the job and run id; a bare job name (periodic jobs only) needs the run id passed too. `selftest` checks the
parsing without touching the network. It needs nothing but Node — no dependencies, no Python.

The script prints the result, the failed steps, the signature taken from the first failed step's
output, artifacts for that step (screenshots, videos, junit, per-step `build-log.txt`) and the pass/fail
history of the last runs with a `same-signature` / `different` marker. It is evidence, not a verdict:
you compose the six-field report (step 5) after collecting the evidence. The log is saved to
`/tmp/prow-<run-id>/build-log.txt` — read the saved log with the `read` tool.

The script reads only the public bucket. Private jobs live in `test-platform-results` and need auth; on a
miss the error prints the `gcloud storage cat gs://test-platform-results/…` command to run instead. Every
artifact line it prints is a full URL — fetch it with `curl -o /tmp/x '<url>'`.

If you can view images, fetch the `(failed).png` screenshot and look at it — it usually names the cause
(perspective, empty list, error toast) faster than the log. If you cannot, print the path for the user.

## 2. Classify the owner before reading test output

Most failures are not ours. Read [references/triage.md](references/triage.md) for the owner table and the
symptoms this repository's periodics have produced before.

## 3. Read the failure, don't guess

- Cypress: find `(Results)` and the `1)` block. `This error occurred while creating the session` or
  `in a "before all" hook` means setup failed — report "N of M specs never ran", because zero assertions
  is not a product signal.
- Follow the `cy.log` trail to the last thing that succeeded; the failing assertion is usually one step
  after the real cause.
- `Get pod image`, `Getting OCP version`, `collectDebugInfo`, `aboutModal` are debug instrumentation, gated
  on `Cypress.env('DEBUG')` (set by the `CYPRESS_DEBUG` environment variable). A failure there is a
  test-infrastructure bug, not a plugin bug.
- Identity and perspective decide what the UI can render: `Logging in as <user>`,
  `Perspective switcher toggle not shown`.

## 4. Determinism before editing anything

Two or more consecutive failed runs with the same signature (the script marks them) show the failure is
repeatable — not, by themselves, that this repository regressed. Before changing code, also find a recent
passing baseline (and what changed since) or other evidence that the cause is repository-owned (a spec,
selector, or helper that no longer matches). A different signature each run points to flake — report it, do
not rewrite test code to chase it. Classify install and gather step failures from their log evidence like
any other step; do not assume they are environmental.

## 5. Fix or report

Fix in the working tree when the cause is a spec, page object, command helper, selector, or assertion that no
longer matches the product or the CI environment. Report when the cause is upstream (console markup from a
different version, cluster/operator state, image promotion, quota, flake).

Never: re-run the job until it goes green, weaken an assertion to silence a failure, edit the job
definition (it lives in `openshift/release`, not here), or commit, push, or open a PR. Leave the fix
unstaged for the user to review; they decide what gets committed.

A report has six fields:

```
job/run:   <prow url>
first failing step: <name> (after <duration>)
cause:      <one sentence>
evidence:   <the signature line> + <x/y recent runs, same signature?>
verdict:    our bug (fix uncommitted in: <files>) | upstream <component> | environment/flake
next:       <the single action someone should take>
```

The fix is unproven until a run of the same job passes after it merges; say so in `next`.

## 6. When the fix is Cypress code

- Prefer `cy.adminCLI('oc …')` over UI navigation for helpers and diagnostics: the UI requires a
  perspective and permissions the CI user may not have.
- A diagnostic must not be able to fail the run: pass `{ failOnNonZeroExit: false }` and log the result
  instead of asserting on it.
- The dev periodics log in as the non-admin `LOGIN_USERNAME` set by the CI job (in `openshift/release`).
  `web/cypress/support/commands/auth-commands.ts` grants it only `view` + `monitoring-edit` in `default`
  and `openshift-monitoring`, so it sees the Developer perspective only. Only admin jobs run as `kubeadmin`.
- A helper that logs "skipping" and continues destroys the evidence and moves the failure to a later,
  unrelated timeout. Assert the precondition or do not depend on it.
- Verify with `make lint-frontend` and the frontend checks in `CONTRIBUTING.md`.
