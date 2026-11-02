# Prow/CI triage reference

Symptom-to-owner mapping and the failures this repository's periodics have produced before. Treat these
as investigation prompts; verify against the log you actually have.

## Who owns the failure

| Evidence in `build-log.txt`                                                           | Owner                          | Outcome      |
| ------------------------------------------------------------------------------------- | ------------------------------ | ------------ |
| failure in `pre` phase, `ipi-install-*`, `aws-provision-iam-user`, lease/quota errors | infra                          | report       |
| release/imagestream errors, `Could not resolve … image`, `stable` import failures     | build/promotion                | report       |
| `Step …-tests-… failed` (our e2e step)                                                | this repo                      | keep reading |
| `ContainerFailed`, exit code != 0                                                     | wrapper around the step output | keep reading |

## Known traps

| Symptom                                                                                      | Meaning                                                                     | Action                                                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| 220-byte XML `<Code>ExpiredToken</Code>`                                                     | the artifact link expired                                                   | re-fetch unsigned                                        |
| `Perspective switcher toggle not shown` then a table timeout                                 | non-admin user has no Administrator perspective, the switch silently no-ops | stop navigating the UI as part of setup                  |
| a debug/diagnostic helper (`Get pod image`, `collectDebugInfo`) fails in a `before all` hook | instrumentation broke session setup; it must log, never assert              | move it to `cy.adminCLI` with `failOnNonZeroExit: false` |
| `0 passing` + `1 failing` in `before all`, both specs                                        | session gate, not the product                                               | fix the helper in the session callback                   |
| `npm warn EBADENGINE`, `npm warn deprecated`                                                 | install noise                                                               | ignore                                                   |
| every retained run of the job fails                                                          | long-broken job                                                             | say so; do not assume today's run is a regression        |

## Bucket names

`test-platform-results-public` reads anonymously (`HTTP 200`); periodics live under `logs/`, presubmits
under `pr-logs/pull/<org_repo>/<pr>/`. `test-platform-results` returns `401` and needs `gcloud storage`. If the public bucket ever starts returning `403`, the name moved — check
`openshift/release`, not this script.
