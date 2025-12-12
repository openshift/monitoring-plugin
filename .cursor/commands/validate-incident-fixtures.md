# Validate Incident Fixtures

## Overview
Validate existing YAML incident fixture files against the JSON Schema to ensure they are properly structured and will work correctly in tests.

## Process

### 1. Locate Fixture Files
- Check `web/cypress/fixtures/incident-scenarios/` directory
- Identify all `.yaml` and `.yml` files
- Also validate any `.json` fixture files for backward compatibility

### 2. Run Schema Validation
Use the validation tool to check each fixture:
```bash
cd web/cypress/support/incidents_prometheus_query_mocks
node validate-fixtures.js --all
```

### 3. Analyze Results
For each fixture file:
- ✅ **Valid**: Fixture passes all schema validation
- ❌ **Invalid**: Identify specific validation errors
- 🔧 **Fixable**: Determine if errors can be automatically corrected

### 4. Fix Validation Issues
Common issues and fixes:

#### Missing Required Fields
- Add missing `name`, `description`, or `incidents` fields
- Ensure all incidents have required `id`, `component`, `layer`, `alerts`

#### Invalid Duration Format
- Fix duration strings to use format: `"2h"`, `"30m"`, `"7d"`
- Remove invalid formats like `"2 hours"`, `"30 minutes"`

#### Invalid Enum Values
- **Components**: Use only valid values (monitoring, storage, network, etc.)
- **Layers**: Use only `"core"` or `"Others"`
- **Severities**: Use only `"critical"`, `"warning"`, or `"info"`

#### YAML Syntax Errors
- Fix indentation issues
- Correct quote usage
- Ensure proper array formatting

#### Alert Structure Issues
- Ensure alerts have `name`, `namespace`, `severity`
- Verify alert names are realistic OpenShift alert names
- Check namespace formats match OpenShift conventions

## Validation Checklist

### Schema Compliance
- [ ] All required fields present
- [ ] Valid component enum values
- [ ] Valid layer enum values  
- [ ] Valid severity enum values
- [ ] Proper duration format
- [ ] Correct YAML syntax

### Content Quality
- [ ] Realistic alert names
- [ ] Proper OpenShift namespaces
- [ ] Logical timeline values
- [ ] Descriptive scenario names
- [ ] Clear descriptions

### Test Readiness
- [ ] Fixtures can be loaded without errors
- [ ] Schema validation passes
- [ ] Ready for use in Cypress tests

## Common Fixes

### Fix Duration Format
```yaml
# Before
start: "2 hours ago"
end: "30 minutes ago"

# After  
start: "2h"  # Started 2 hours ago
end: "30m"   # Resolved 30 minutes ago
```

### Fix Component Names
```yaml
# Before
component: "monitoring-system"

# After
component: "monitoring"
```

### Fix Alert Structure
```yaml
# Before
alerts:
  - alert_name: "SomeAlert"
    alert_namespace: "monitoring"
    alert_severity: "high"

# After
alerts:
  - name: "AlertmanagerReceiversNotConfigured"
    namespace: "openshift-monitoring"
    severity: "critical"
    firing: true
```

## Output
Provide:
1. **Validation Summary**: List of all fixtures and their validation status
2. **Error Details**: Specific validation errors for any failed fixtures
3. **Fix Suggestions**: Recommended changes for invalid fixtures
4. **Corrected Fixtures**: Updated YAML content for any fixtures that need fixes

## Tools Available
- Schema validator: `web/cypress/support/incidents_prometheus_query_mocks/schema-validator.ts`
- CLI validator: `web/cypress/support/incidents_prometheus_query_mocks/validate-fixtures.js`
- JSON Schema: `web/cypress/support/incidents_prometheus_query_mocks/fixture-schema.json`
