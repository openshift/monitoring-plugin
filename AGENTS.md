# OpenShift Monitoring Plugin - AI Agent Guide

## Quick Start (30-second overview)

- **What**: Dual frontend plugins for OpenShift observability (monitoring-plugin + monitoring-console-plugin)
- **Purpose**: Alerts, Metrics, Targets, Dashboards + Perses, Incidents, ACM integration
- **Tech Stack**: React + TypeScript + Webpack + i18next + Go
- **Key Files**: `web/console-extensions.json`, `web/src/components/`

## Common Tasks & Workflows

### Adding a New Feature

1. Check if it belongs in `monitoring-plugin` (core) or `monitoring-console-plugin` (extended)
2. Update console extensions in `web/console-extensions.json`
3. Add React components in `web/src/components/`
4. Add translations in `public/locales/`
5. Test with `make lint-frontend && make test-backend`

### Debugging Issues

- **Build failures**: Check `Makefile` targets
- **Console integration**: Verify `console-extensions.json`
- **Plugin loading**: Check OpenShift Console logs
- **Perses dashboards**: Debug at `web/src/components/dashboards/perses/`

### Development Setup

- See README.md for full setup
- Deployment: https://github.com/observability-ui/development-tools/

## Development Context

### When working on Alerts:

- Files: `web/src/components/alerts/`
- Integration: Alertmanager API
- Testing: Cypress tests in `web/cypress/`

### When working on Dashboards:

- **Legacy**: Standard OpenShift dashboards
- **Perses**: `web/src/components/dashboards/perses/` (uses ECharts wrapper)
- **Upstream**: https://github.com/perses/perses

### When working on ACM:

- Multi-cluster observability
- Hub cluster aggregation
- Thanos/Alertmanager integration

## Important Decision Points

### Choosing Between Plugins:

- **monitoring-plugin**: Core observability (always available)
- **monitoring-console-plugin**: Optional features (COO required)

### Adding Dependencies:

- Check compatibility with OpenShift Console versions
- Verify i18next translation support
- Consider CMO vs COO deployment differences

## External Dependencies & Operators

| System      | Repository                                               | Purpose                           |
| ----------- | -------------------------------------------------------- | --------------------------------- |
| CMO         | https://github.com/openshift/cluster-monitoring-operator | Manages monitoring-plugin         |
| COO         | https://github.com/rhobs/observability-operator          | Manages monitoring-console-plugin |
| Perses      | https://github.com/perses/perses                         | Dashboard engine                  |
| Console SDK | https://github.com/openshift/console                     | Plugin framework                  |

## Technical Documentation

### Console Plugin Framework

- Plugin SDK: https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk
- Extensions docs: https://github.com/openshift/console/blob/main/frontend/packages/console-dynamic-plugin-sdk/docs/console-extensions.md
- Example plugin: https://github.com/openshift/console/tree/main/dynamic-demo-plugin

### Operator Integration

- **CMO (monitoring-plugin)**: Integrated with cluster monitoring stack
- **COO (monitoring-console-plugin)**: Optional operator for extended features
- **UIPlugin CR example**:

```yaml
apiVersion: observability.openshift.io/v1alpha1
kind: UIPlugin
metadata:
  name: monitoring
spec:
  type: Monitoring
  monitoring:
    acm:
      enabled: true
      alertmanager:
        url: "https://alertmanager.open-cluster-management-observability.svc:9095"
      thanosQuerier:
        url: "https://rbac-query-proxy.open-cluster-management-observability.svc:8443"
    perses:
      enabled: true
    incidents:
      enabled: true
```

### Perses Integration Details

- **Core**: https://github.com/perses/perses
- **Plugins**: https://github.com/perses/plugins (chart specifications and datasources)
- **Operator**: https://github.com/perses/perses-operator (Red Hat fork: https://github.com/rhobs/perses)
- **Chart Engine**: ECharts (https://echarts.apache.org/)

### ACM Observability

- **Multi-cluster monitoring**: Centralized observability across managed clusters
- **Components**: Hub cluster Thanos, Grafana, Alertmanager + endpoint operators
- **Integration**: COO provides unified alerting UI for ACM environments
- **Features**: Cross-cluster silences, cluster-labeled alerts, centralized metrics

## Release & Testing

### Before submitting a PR run the following and address any errors:

```bash
make lint-frontend
make lint-backend
make test-translations
make test-backend
make test-frontend
# future slash command for test execution
```

### PR Requirements:

- **Title format**: `[JIRA_ISSUE]: Description`
- **Testing**: All linting and tests must pass
- **Translations**: Ensure i18next keys are properly added

### Unit Testing

#### Overview

The Monitoring Plugin uses a dual testing approach for unit tests:

- **Frontend Unit Tests**: Jest + TypeScript for React components and utilities
- **Backend Unit Tests**: Go's built-in testing framework for server functionality

Unit tests focus on isolated function testing and run quickly in CI/CD pipelines, while E2E tests (Cypress) validate full user workflows.

#### Test File Structure

**Frontend Tests:**

- **Location**: Co-located with source files in `web/src/`
- **Naming**: `*.spec.ts` (e.g., `format.spec.ts`, `utils.spec.ts`)
- **Framework**: Jest 30.2.0 with ts-jest
- **Configuration**: `web/jest.config.js`

**Backend Tests:**

- **Location**: Co-located with source files in `pkg/`
- **Naming**: `*_test.go` (e.g., `server_test.go`)
- **Framework**: Go testing package + testify/require
- **Configuration**: Standard Go test conventions

#### Running Unit Tests

```bash
# Run all tests (backend + frontend)
make test-backend
make test-frontend

# Run individually from web directory
cd web && npm run test:unit

# Run Go tests directly
go test ./pkg/... -v
```

#### When to Create Unit Tests

Create unit tests when:

1. **Adding utility functions**: Pure functions, formatters, data transformations
2. **Adding business logic**: Data processing, calculations, validations
3. **Fixing bugs**: Regression tests to prevent bug recurrence
4. **Adding API handlers**: Backend endpoint logic (Go tests)

#### Key Testing Libraries

**Frontend:**

- `jest` (v30.2.0) - Test runner and assertions
- `ts-jest` (v29.4.4) - TypeScript support
- `@types/jest` - TypeScript definitions

**Backend:**

- `testing` (stdlib) - Go testing framework
- `github.com/stretchr/testify` (v1.9.0) - Assertions and test utilities

#### Frontend Unit Testing Structure

**Testing Framework & Configuration**
Test Framework: Jest + ts-jest
Configuration File: web/jest.config.js

**Test File Location & Naming Convention**
Pattern: \*.spec.ts files co-located with source code

**Test Coverage Areas**

- Edge cases (null, undefined, empty values)
- Normal behavior and expected outputs
- Boundary conditions
- Complex scenarios and integration
- Data transformations and formatting

#### Backend Unit Testing Structure

**Testing Framework & Configuration**
Test Framework: Go's built-in testing package
Assertion Library: github.com/stretchr/testify v1.9.0

**Test File Location & Naming Convention**
Pattern: \*\_test.go files in the same directory as source code

**Test Helper Functions**

- `startTestServer()` - Starts server for testing
- `prepareServerAssets()` - Sets up test environment
- `generateCertificate()` - Creates TLS certificates for tests
- `checkHTTPReady()` - Waits for server to be ready
- `getRequestResults()` - Makes HTTP requests

**Test Coverage Areas**

- HTTP server functionality
- HTTPS/TLS configuration
- Certificate handling
- Security settings (TLS versions, cipher suites)
- Endpoint availability

### Cypress E2E Testing

#### Overview

The Monitoring Plugin uses Cypress for comprehensive End-to-End (E2E) testing to ensure functionality across both the core **monitoring-plugin** (managed by CMO) and the **monitoring-console-plugin** (managed by COO). Our test suite covers test scenarios including alerts, metrics, dashboards, and integration with Virtualization and Fleet Management (ACM).

**Key Testing Documentation:**

- **Setup & Configuration**: `web/cypress/README.md` - Environment variables, installation, troubleshooting
- **Testing Guide**: `web/cypress/CYPRESS_TESTING_GUIDE.md` - Test architecture, creating tests, workflows
- **Test Catalog**: `web/cypress/E2E_TEST_SCENARIOS.md` - Complete list of all test scenarios

#### When to Create New Cypress Tests

You should create new Cypress tests when:

1. **Adding New Features**: Any new UI feature requires corresponding E2E tests
2. **Fixing Bugs**: Bug fixes should include tests to prevent regression
3. **Modifying Existing Features**: Changes to existing functionality require test updates

#### Quick Test Commands

```bash
cd web/cypress

# Run all regression tests
npm run cypress:run --spec "cypress/e2e/**/regression/**"

# Run BVT (Build Verification Tests)
npm run cypress:run --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"

# Run COO tests
npm run cypress:run --spec "cypress/e2e/coo/*.cy.ts"

# Interactive mode
npm run cypress:open
```

For detailed testing instructions, see `web/cypress/CYPRESS_TESTING_GUIDE.md`

### Release Pipeline:

- **Konflux**: Handles CI/CD and release automation
- **CMO releases**: Follow OpenShift release cycles
- **COO releases**: Independent release schedule

## Skills

### Feature Backporting

For backporting features from `main` to release branches (e.g., `release-4.x`, `release-coo-x.y`), use the `/backport` slash command:

```bash
/backport <target-branch> [commit-hash]
# Examples:
/backport release-4.18
/backport release-coo-0.4 abc123
```

The command is located at `.claude/commands/backport.md` and handles:

- PatternFly v6 → v5 component transformations
- React Router v6 → v5 hook adaptations
- Console SDK API compatibility
- Dependency version differences between branches
- Project structure differences (web/ vs root for older releases)

## Security & RBAC

### Plugin Security Model:

- Inherits OpenShift Console RBAC
- Respects cluster monitoring permissions
- ACM integration requires appropriate hub cluster access

### Development Security:

- No credentials in code
- Use cluster service accounts
- Follow OpenShift security guidelines

## Getting Help

| Topic           | Channel/Resource                                                 |
| --------------- | ---------------------------------------------------------------- |
| Console Plugins | OpenShift Console SDK documentation                              |
| Perses          | Slack: Cloud Native Computing Foundation >> #perses-dev          |
| COO             | Slack: Internal Red Hat >> #forum-cluster-observability-operator |

## Additional Resources

### Development Tools & Scripts:

- **Monitoring Plugin**: https://github.com/observability-ui/development-tools/tree/main/monitoring-plugin
- **Perses**: https://github.com/observability-ui/development-tools/tree/main/perses
- **Wiki**: https://github.com/observability-ui/development-tools/tree/main/wiki

### Code Style & Standards:

- **TypeScript**: https://www.typescriptlang.org/
- **React**: https://react.dev/
- **Webpack**: https://webpack.js.org/
- **Go**: https://go.dev/
- **i18next**: https://www.i18next.com/

---

_This guide is optimized for AI agents and developers. For detailed setup instructions, also refer to README.md and Makefile._
