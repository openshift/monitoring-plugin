# Prometheus Query Mocking System

This directory contains the Prometheus query mocking system for incident scenarios in Cypress tests. The system intercepts Prometheus API calls and returns mock data based on YAML fixture definitions.

## Overview

The mocking system allows you to:
- Define incident scenarios using YAML fixtures with schema validation
- Mock Prometheus `query_range` API calls for both incident health data and alert details
- Support complex timelines with severity changes and resolved/ongoing incidents
- Filter mock data based on query parameters (alertname, namespace, severity, group_id)

## Quick Start

### Using YAML Fixtures

```typescript
// Load a YAML fixture
cy.mockIncidentFixture('cypress/fixtures/incident-scenarios/critical-monitoring-issues.yaml');
```

### Using Direct Incident Definitions

```typescript
const incidents: IncidentDefinition[] = [
  {
    id: 'monitoring-critical-001',
    component: 'monitoring',
    layer: 'core',
    timeline: { start: Date.now() - 3600000 }, // 1 hour ago
    alerts: [
      {
        name: 'AlertmanagerReceiversNotConfigured',
        namespace: 'openshift-monitoring',
        severity: 'warning'
      }
    ]
  }
];

cy.mockIncidents(incidents);
```

## Key Features

- **Schema Validation**: All YAML fixtures are validated against JSON Schema
- **Query Filtering**: Mock data is filtered based on Prometheus query parameters
- **Timeline Support**: Define incident start/end times and severity changes
- **Timezone Configuration**: Set timezone via `CYPRESS_TIMEZONE` environment variable
- **Multiple Query Types**: Supports both `cluster:health:components:map` and `ALERTS` queries

## File Structure

- `types.ts` - TypeScript type definitions
- `utils.ts` - Utility functions for parsing and timezone handling
- `mock-generators.ts` - Generates Prometheus mock data
- `prometheus-mocks.ts` - Main mocking logic and Cypress commands
- `index.ts` - Main export file

### Schema Files (`schema/` subdirectory)

- `fixture-schema.json` - JSON Schema definition for YAML fixtures
- `schema-validator.ts` - Schema validation logic
- `fixture-converter.ts` - Converts fixtures to incident definitions
- `validate-fixtures.ts` - Validation script for fixtures
- `yaml-fixture-snippets.json` - YAML snippets for common patterns

## Development Tools

### Custom Cursor Commands

The `.cursor/commands/` directory contains custom commands for working with incident fixtures:

- **`generate-incident-fixture.md`** - Generate valid YAML incident fixtures from text descriptions or UI screenshots
- **`validate-incident-fixtures.md`** - Validate existing YAML fixture files against the JSON Schema
- **`fixture-schema-reference.md`** - Quick reference for schema structure, valid values, and common patterns

These commands help with:
- Creating new incident scenarios from descriptions or screenshots
- Validating fixture files before committing
- Understanding schema structure and valid values

### Validation

Validate fixtures using the CLI tool:

```bash
cd web
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- --all
npm run ts-node cypress/support/incidents_prometheus_query_mocks/schema/validate-fixtures.ts -- specific-file.yaml
```

## Configuration

### Timezone

Set the timezone for incident timeline calculations:

```bash
export CYPRESS_TIMEZONE="America/New_York"
export CYPRESS_TIMEZONE="Europe/London" 
export CYPRESS_TIMEZONE="Asia/Tokyo"
```

Default: UTC (if `CYPRESS_TIMEZONE` is not set)

## YAML Fixture Format

```yaml
name: "Scenario Name"
description: "Detailed description"
incidents:
  - id: "unique-incident-id"
    component: "monitoring|storage|network|compute|api-server|etcd|version|Others"
    layer: "core|Others"
    timeline:
      start: "2h"  # Duration format: 30m, 2h, 7d
      end: "1h"    # Optional, omit for ongoing incidents
    alerts:
      - name: "AlertName"
        namespace: "openshift-namespace"
        severity: "critical|warning|info"
        firing: true|false
```

For detailed schema documentation and examples, see the files in the `schema/` subdirectory.