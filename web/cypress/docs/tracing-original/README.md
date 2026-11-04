# Preserved distributed tracing E2E material

Source: `openshift/distributed-tracing-console-plugin` commit
`a18f314ec7e2a7fd146ccf86c83f4f3edf552270`, under `tests/`.

Preserve helpers and fixtures even if no current test calls them: they may support
unfinished or future tests. This import does not enable dormant tests or retarget
the legacy suite to the merged MCP backend.

## Mapping into this Cypress harness

- `e2e/dt-plugin-tests.cy.ts` → `e2e/tracing/coo_tracing.cy.ts` (all 15 cases).
- `e2e/dt-plugin-tests-debug.cy.ts.skip` →
  `e2e/tracing/coo_tracing_debug.cy.ts.skip` (kept disabled; empty debug case).
  Its setup changes cluster-admin bindings and expects an existing legacy setup.
- All 56 custom commands are preserved or reused. Most tracing commands are in
  `support/commands/tracing-commands.ts`; the 17 previously unused implementations
  are in `support/commands/tracing-preserved-commands.ts`. Both are registered by
  `support/index.ts`.
- Tracing's `login` is `dtLogin`; its `switchPerspective` is
  `dtSwitchPerspective`, including the call from `uiLogin`. These aliases preserve
  tracing behavior without overriding monitoring-plugin's implementations.
- `views/pages.ts` and `views/search.ts` → `views/tracing-pages.ts` and
  `views/tracing-search.ts`; their exports remain unchanged.
- Other views → `views/tracing-{lightspeed,operator-hub-page,tour}.ts`;
  `views/utils.ts`'s `clickIfExist` is reused from monitoring-plugin.
- `fixtures/chainsaw-tests/` → `fixtures/coo/traces/chainsaw/`.
- Lightspeed fixtures, Chainsaw config, UIPlugin fixtures and image scripts →
  `fixtures/coo/traces/`. `update-plugin-image.sh` is
  `update-dt-plugin-image.sh`. The existing
  `fixtures/coo/coo-imagecontentsourcepolicy.yaml` is reused.
- `coo-imagedigestmirror.yaml` and `monitoring-with-perses.yaml` are preserved in
  `fixtures/coo/traces/`, even though the main spec does not reference them.

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
The original `muiFirstSpanBar` ignored its options; that behavior is preserved,
with its unused options local removed to satisfy TypeScript.

Restoring these artifacts is not evidence that dormant helpers work on a live
cluster. Keep live-validation results separate from this preservation inventory.
