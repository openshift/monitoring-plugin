---
name: generate-incident-fixture
description: Create schema-valid YAML incident fixtures for Cypress from a description or screenshot. Use for fixtures under the incident-scenarios directory.
---

# Generate an incident fixture

Before editing, read:

- `.agents/references/incidents-testing-guidelines.md`;
- `web/cypress/support/incidents_prometheus_query_mocks/schema/fixture-schema.json`;
- nearby fixtures under `web/cypress/fixtures/incident-scenarios/`.

The JSON Schema is authoritative. Do not recreate it in the skill.

## Workflow

1. Extract the scenario, incidents, alerts, severities, namespaces, and timelines from the request or screenshot.
2. Use relative durations accepted by the schema, never absolute timestamps. For screenshots, measure from the end of the displayed chart and preserve different incident and alert timelines.
3. Use a descriptive generic filename and unique incident IDs. Prefer artificial, descriptive alert names with unique suffixes when real alert identity is not part of the scenario.
4. Write YAML under `web/cypress/fixtures/incident-scenarios/`, unless the user specifies a disposable output location.
5. From `web/`, validate the specific file:

   ```bash
   npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- cypress/fixtures/incident-scenarios/<file>.yaml
   ```

6. Correct schema or YAML errors and rerun validation. Report the file and validation result.
