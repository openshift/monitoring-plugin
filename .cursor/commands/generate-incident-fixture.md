---
description: Generate valid YAML incident fixtures for Cypress testing
---

# Generate Incident Fixture

Generate valid YAML fixtures for incident scenarios based on text descriptions or UI screenshots.

## Process

### 1. Analyze Input
- **Text Description**: Extract incident components, alert names, severities, and timeline
- **Screenshot**: Identify visible incidents, alerts, and timeline - **CONVERT ALL DATES TO RELATIVE TIME**. There will be usually one chart 'Incident Timeline' displaying the incident timelines and second one 'Alert Timelines' which displays alerts for **a single particular incident**. When the Alert timeline is visible, include timestamps for the individual alerts within the incident, which may differ from the incident one.
- Focus on capturing the precise start and end dates for incidents and individual alerts so that the variability from the screenshot is preserved.

### 2. Generate YAML Structure
Create fixture following the schema in [fixture-schema.json](mdc:web/cypress/support/incidents_prometheus_query_mocks/fixture-schema.json). Prefer this schema over existing fixtures.

```yaml
name: "[Scenario Name]"
description: "[Detailed description]"
incidents:
  - id: "[unique-incident-id]"
    component: "[component-name]"
    layer: "[core|Others]"
    timeline:
      start: "[duration]"
      # end: "[duration]" # Only if resolved
    alerts:
      - name: "[alert-name]"
        namespace: "[namespace]"
        severity: "[critical|warning|info]"
        firing: [true|false]
        timeline:
          start: "[duration]"
```

### 3. Apply Constraints
- **Name and Description**: Use generic name capturing the essence of the scenario
- **File name**: Use generic name capturing the essence of the scenario
- **Components**: `monitoring`, `storage`, `network`, `compute`, `api-server`, `etcd`, `version`, `Others`
- **Layers**: `core`, `Others`
- **Severities**: `critical`, `warning`, `info`
- **Duration Format**: `<number><unit>` (e.g., `"2h"`, `"30m"`, `"7d"`)
- **Alert Names**: Use descriptive, artificial names with unique indices (e.g., `"MonitoringAlertmanagerReceiversCritical001"`)

### 4. Time Conversion Rules
- **NEVER use absolute dates/timestamps**
- Convert screenshot dates to relative durations from the end of the chart
- Example: If screenshot shows "2024-01-15 14:30" and current time is "2024-01-15 16:30", use `"2h"`

### 5. Run validation
- run the validation using [fixture-schema.json](mdc:web/cypress/support/incident_prometheus_query_mocks/validate_fixture.js)

```yaml

## Validation Checklist
- [ ] All required fields present (name, description, incidents)
- [ ] Incident IDs are unique and follow naming convention
- [ ] Components and layers use valid enum values from schema
- [ ] Duration format matches pattern `^\d+[smhd]$`
- [ ] **NO absolute dates or timestamps used - only relative durations**
- [ ] Alert names are descriptive and artificial with unique indices
- [ ] Alerts have timelines if different when the incidents
- [ ] Namespaces follow OpenShift conventions
- [ ] Severity levels are valid (critical, warning, info)
- [ ] YAML syntax is correct with proper indentation
- [ ] Schema validation passes against [fixture-schema.json](mdc:web/cypress/support/incidents_prometheus_query_mocks/fixture-schema.json)

## Output
Provide complete YAML fixture ready for use with `cy.mockIncidentFixture()` in Cypress tests.