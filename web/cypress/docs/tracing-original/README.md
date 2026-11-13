# Preserved distributed tracing E2E material

Source: `openshift/distributed-tracing-console-plugin` commit
`a18f314ec7e2a7fd146ccf86c83f4f3edf552270`, under `tests/`.

Only material the ported suite uses was imported. Upstream keeps artifacts that no
current test calls (a disabled debug spec, unused command implementations, view
modules and fixtures); they were not imported, but can be taken from the source
commit above if a future test needs them. This import does not enable dormant
tests or retarget the legacy suite to the merged MCP backend.

## Mapping into this Cypress harness

- `e2e/dt-plugin-tests.cy.ts` → `e2e/tracing/coo_tracing.cy.ts` (all 15 cases).
- The commands the suite calls are in `support/commands/tracing-commands.ts`,
  registered by `support/index.ts`; 13 more are reused from monitoring-plugin.
  DT's 17 unused command implementations (including its `uiLogin`, `uiLogout`,
  `cliLogin`, `cliLogout`, `dtSwitchPerspective` and OLS mock interceptors) were
  not imported.
- Tracing's `login` is `dtLogin`, so monitoring-plugin's `login` keeps its
  behavior; monitoring-plugin's `switchPerspective` is untouched.
- Views → `views/tracing-{lightspeed,operator-hub-page,tour}.ts`;
  `views/utils.ts`'s `clickIfExist` is reused from monitoring-plugin.
- `fixtures/chainsaw-tests/` → `fixtures/coo/traces/chainsaw/`.
- Lightspeed fixtures, Chainsaw config, UIPlugin fixtures and image scripts →
  `fixtures/coo/traces/`. `update-plugin-image.sh` is
  `update-dt-plugin-image.sh`. The existing
  `fixtures/coo/coo-imagecontentsourcepolicy.yaml` is reused.

The three adjacent documents are verbatim historical references. Paths and
examples in them refer to the original harness; use the mapping above and the
current `cypress/README.md` for this repository. They are not a current coverage
or validation report.

Standalone Dockerfiles, dependency manifests/lockfile, Cypress/TypeScript/reporter
configuration and support bootstrap are replaced by monitoring-plugin's harness,
not duplicated. The original README is replaced by `cypress/README.md`; its
agent-specific `CLAUDE.md` is not imported as repository instructions.

## Mechanical adaptations

Cypress 15's `cy.exec` `exitCode` is `code` in this Cypress 14 harness.
File paths, tracing aliases, formatting and lint/type annotations are adapted.

Importing these artifacts is not evidence that the helpers work on a live
cluster. Keep live-validation results separate from this preservation inventory.
