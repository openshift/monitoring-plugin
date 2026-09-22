# Incident fixture schema orientation

The canonical JSON Schema is:

`web/cypress/support/incidents_prometheus_query_mocks/schema/fixture-schema.json`

A fixture contains a nonempty `name`, a nonempty `description`, and an `incidents` array. Every incident requires `id`, `component`, `layer`, and at least one alert. Timelines are optional on incidents and alerts; when present they require `start` and may contain `end` and `severityChanges`.

Durations are relative and may combine seconds, minutes, hours, and days, such as `30m`, `1h30m`, or `7d2h`. Consult the schema for the current component, layer, and severity enums, optional alert fields, and exact patterns.

Validate from `web/`:

```bash
# All YAML fixtures
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- --all

# Specific fixture
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- cypress/fixtures/incident-scenarios/<file>.yaml
```
