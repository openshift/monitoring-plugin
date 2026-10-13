# Fixture Schema Reference

## Overview
Quick reference for the YAML fixture schema structure, valid values, and common patterns.

## Schema Structure

```yaml
name: string                    # Required: Human-readable scenario name
description: string             # Required: Detailed description
incidents: array                # Required: Array of incident objects
  - id: string                  # Required: Unique incident identifier
    component: string           # Required: Component affected
    layer: string              # Required: Layer (core/Others)
    timeline: object           # Optional: Timeline information
      start: string            # Required: When incident started
      end: string              # Optional: When incident ended
      severityChanges: array   # Optional: Severity changes over time
    alerts: array              # Required: Array of alert objects
      - name: string           # Required: Alert name
        namespace: string      # Required: Alert namespace
        severity: string       # Required: Alert severity
        firing: boolean        # Optional: Firing state
    managed_cluster: string    # Optional: Managed cluster ID
```

## Valid Values

### Components
- `monitoring` - Monitoring infrastructure
- `storage` - Storage systems
- `network` - Network components
- `compute` - Compute resources
- `api-server` - Kubernetes API server
- `etcd` - etcd cluster
- `version` - Cluster version
- `Others` - Other components

### Layers
- `core` - Core OpenShift components
- `Others` - Non-core components

### Severities
- `critical` - Critical alerts
- `warning` - Warning alerts
- `info` - Informational alerts

### Duration Format
- Pattern: `^\d+[smhd]$`
- Examples: `"30m"`, `"2h"`, `"7d"`, `"1h"`
- Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days)

## Common Alert Names

### Monitoring Component
```yaml
- name: "AlertmanagerReceiversNotConfigured"
  namespace: "openshift-monitoring"
  severity: "warning"

- name: "KubeDeploymentReplicasMismatch"
  namespace: "openshift-monitoring"
  severity: "critical"

- name: "KubePodCrashLooping"
  namespace: "openshift-monitoring"
  severity: "warning"

- name: "PrometheusConfigReloadFailure"
  namespace: "openshift-monitoring"
  severity: "warning"

- name: "Watchdog"
  namespace: "openshift-monitoring"
  severity: "info"
```

### Storage Component
```yaml
- name: "KubePersistentVolumeFillingUp"
  namespace: "openshift-storage"
  severity: "critical"

- name: "DiskSpaceRunningLow"
  namespace: "openshift-storage"
  severity: "critical"

- name: "VolumeReadOnly"
  namespace: "openshift-storage"
  severity: "critical"
```

### Network Component
```yaml
- name: "NetworkLatencyHigh"
  namespace: "openshift-network"
  severity: "warning"

- name: "EtcdMemberCommunicationSlow"
  namespace: "openshift-etcd"
  severity: "warning"
```

### Compute Component
```yaml
- name: "NodeNotReady"
  namespace: "openshift-machine-api"
  severity: "critical"

- name: "KubeNodeUnreachable"
  namespace: "openshift-machine-api"
  severity: "critical"
```

## Timeline Patterns

### Simple Ongoing Incident
```yaml
timeline:
  start: "2h"  # Started 2 hours ago
```

### Resolved Incident
```yaml
timeline:
  start: "4h"   # Started 4 hours ago
  end: "1h"     # Resolved 1 hour ago
```

### Severity Escalation
```yaml
timeline:
  start: "3h"   # Started 3 hours ago
  severityChanges:
    - time: "3h"   # Started as warning
      severity: "warning"
    - time: "1h"   # Escalated to critical 1 hour ago
      severity: "critical"
```

## Validation Rules

### Required Fields
- Root: `name`, `description`, `incidents`
- Incident: `id`, `component`, `layer`, `alerts`
- Alert: `name`, `namespace`, `severity`
- Timeline: `start`

### Format Constraints
- Incident ID: Pattern `^[a-zA-Z0-9-_]+$`
- Duration: Pattern `^\d+[smhd]$`
- Component/Layer/Severity: Must be valid enum values

### Array Constraints
- Incidents: `minItems: 0`
- Alerts: `minItems: 1` per incident

## Usage in Tests

```typescript
// Load YAML fixture
cy.mockIncidentFixture('cypress/fixtures/incident-scenarios/critical-monitoring-issues.yaml');

// Load JSON fixture (backward compatibility)
cy.mockIncidentFixture('cypress/fixtures/incident-scenarios/some-scenario.json');
```

## Validation Tools

### CLI Validation
```bash
cd web/cypress/support/incidents_prometheus_query_mocks
node validate-fixtures.js --all
node validate-fixtures.js specific-file.yaml
```

### Schema Files
- Schema: `web/cypress/support/incidents_prometheus_query_mocks/fixture-schema.json`
- Validator: `web/cypress/support/incidents_prometheus_query_mocks/schema-validator.ts`
- CLI Tool: `web/cypress/support/incidents_prometheus_query_mocks/validate-fixtures.js`

## Best Practices

1. **Naming**: Use descriptive, specific names
2. **Comments**: Add helpful comments for timeline values
3. **Realistic Data**: Use actual OpenShift alert names
4. **Consistent Format**: Follow established patterns
5. **Validation**: Always validate before committing
