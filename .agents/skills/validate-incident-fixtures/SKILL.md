---
name: validate-incident-fixtures
description: Validate one or all Cypress incident YAML fixtures against the repository schema. Use when the user asks to check fixture validity or diagnose fixture validation errors.
---

# Validate incident fixtures

The schema and validator live under `web/cypress/support/incidents_prometheus_query_mocks/schema/`. Run them from `web/` so package scripts and dependencies resolve correctly.

For all YAML fixtures:

```bash
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- --all
```

For explicit files, pass paths relative to `web/` after `--`:

```bash
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- cypress/fixtures/incident-scenarios/<file>.yaml
```

Report each file's result and the validator's concrete schema errors. Validation alone does not authorize edits: suggest fixes, and modify invalid fixtures only when the user asks to fix them. When editing, first read `.agents/references/incidents-testing-guidelines.md` and the current JSON Schema.
