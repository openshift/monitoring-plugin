# E2E Test Scenarios Overview

This document provides a comprehensive overview of all End-to-End (E2E) test scenarios for the Monitoring Plugin, including COO (Cluster Observability Operator) and standard Monitoring tests.

## Table of Contents
- [COO (Cluster Observability Operator) Tests](#coo-cluster-observability-operator-tests)
- [Virtualization Tests](#virtualization-tests)
- [Monitoring Tests](#monitoring-tests)
- [Support Module Test Scenarios](#support-module-test-scenarios)

---

## COO (Cluster Observability Operator) Tests

Located in `e2e/coo/`

### Build Verification Tests (BVT)

| File | Test Suite | Test Scenario | Description |
|------|------------|---------------|-------------|
| `01.coo_bvt.cy.ts` | BVT: COO | 1. Admin perspective - Observe Menu | Verifies Observe menu navigation and submenus (Alerting, Silences, Alerting rules, Dashboards (Perses)) |

---

## Virtualization Tests

Located in `e2e/virtualization/`

These tests verify the Monitoring Plugin functionality within the Virtualization perspective, including integration with OpenShift Virtualization (KubeVirt).

### Integration Verification Tests (IVT)

| File | Test Suite | Test Scenario | Perspective | Namespace Scope |
|------|------------|---------------|-------------|-----------------|
| `01.coo_ivt.cy.ts` | Setting up Monitoring Plugin | 1. Setting up Monitoring Plugin | N/A | N/A |
| `01.coo_ivt.cy.ts` | Installation: Virtualization | 1. Virtualization perspective - Observe Menu | Virtualization | N/A |
| `01.coo_ivt.cy.ts` | IVT: Monitoring + Virtualization | *Runs BVT Monitoring Tests* | Virtualization | All Projects |
| `01.coo_ivt.cy.ts` | IVT: Monitoring + Virtualization - Namespaced | *Runs BVT Monitoring Tests (Namespace)* | Virtualization | openshift-monitoring |
| | | | |
| `02.coo_ivt_alerts.cy.ts` | Setting up Monitoring Plugin | 1. Setting up Monitoring Plugin | N/A | N/A |
| `02.coo_ivt_alerts.cy.ts` | IVT: Monitoring UIPlugin + Virtualization | 1. Virtualization perspective - Observe Menu | Virtualization | N/A |
| `02.coo_ivt_alerts.cy.ts` | Regression: Monitoring - Alerts (Virtualization) | *Runs All Regression Alerts Tests* | Virtualization | All Projects |
| `02.coo_ivt_alerts.cy.ts` | Regression: Monitoring - Alerts Namespaced (Virtualization) | *Runs All Regression Alerts Tests (Namespace)* | Virtualization | openshift-monitoring |
| | | | |
| `03.coo_ivt_metrics.cy.ts` | Setting up Monitoring Plugin | 1. Setting up Monitoring Plugin | N/A | N/A |
| `03.coo_ivt_metrics.cy.ts` | IVT: Monitoring UIPlugin + Virtualization | 1. Virtualization perspective - Observe Menu | Virtualization | N/A |
| `03.coo_ivt_metrics.cy.ts` | Regression: Monitoring - Metrics (Virtualization) | *Runs All Regression Metrics Tests* | Virtualization | All Projects |
| `03.coo_ivt_metrics.cy.ts` | Regression: Monitoring - Metrics Namespaced (Virtualization) | *Runs All Regression Metrics Tests (Namespace)* | Virtualization | openshift-monitoring |
| | | | |
| `04.coo_ivt_legacy_dashboards.cy.ts` | Setting up Monitoring Plugin | 1. Setting up Monitoring Plugin | N/A | N/A |
| `04.coo_ivt_legacy_dashboards.cy.ts` | IVT: Monitoring UIPlugin + Virtualization | 1. Virtualization perspective - Observe Menu | Virtualization | N/A |
| `04.coo_ivt_legacy_dashboards.cy.ts` | Regression: Monitoring - Legacy Dashboards (Virtualization) | *Runs All Regression Legacy Dashboards Tests* | Virtualization | All Projects |
| `04.coo_ivt_legacy_dashboards.cy.ts` | Regression: Monitoring - Legacy Dashboards Namespaced (Virtualization) | *Runs All Regression Legacy Dashboards Tests (Namespace)* | Virtualization | openshift-monitoring |

---

## Monitoring Tests

Located in `e2e/monitoring/`

### Basic Verification Tests (BVT)

| File | Test Suite | Test Scenario | Description | Namespace Scope |
|------|------------|---------------|-------------|-----------------|
| `00.bvt_admin.cy.ts` | BVT: Monitoring | 1. Admin perspective - Observe Menu | Verifies all Observe submenus navigation | All Projects |
| `00.bvt_admin.cy.ts` | BVT: Monitoring | 2. Admin perspective - Overview Page > Status - View alerts | Verifies navigation from Overview status card to Alerting page | All Projects |
| `00.bvt_admin.cy.ts` | BVT: Monitoring | 3. Admin perspective - Cluster Utilization - Metrics | Verifies navigation from cluster utilization to Metrics page | All Projects |
| `00.bvt_admin.cy.ts` | BVT: Monitoring | *Runs BVT Monitoring Tests* | Additional monitoring scenarios from support module | All Projects |
| | | | | |
| `00.bvt_admin.cy.ts` | BVT: Monitoring - Namespaced | Admin perspective - Observe Menu | Verifies all Observe submenus navigation with namespace scope | openshift-monitoring |
| `00.bvt_admin.cy.ts` | BVT: Monitoring - Namespaced | Admin perspective - Overview Page > Status - View alerts | Verifies navigation from Overview status card to Alerting page | openshift-monitoring |
| `00.bvt_admin.cy.ts` | BVT: Monitoring - Namespaced | Admin perspective - Cluster Utilization - Metrics | Verifies navigation from cluster utilization to Metrics page | openshift-monitoring |
| `00.bvt_admin.cy.ts` | BVT: Monitoring - Namespaced | *Runs BVT Monitoring Tests (Namespace)* | Additional monitoring scenarios from support module | openshift-monitoring |

### Regression Tests

| File | Test Suite | Test Scenario | Feature Area | Namespace Scope |
|------|------------|---------------|--------------|-----------------|
| `regression/01.reg_alerts_admin.cy.ts` | Regression: Monitoring - Alerts (Administrator) | *Runs All Regression Alerts Tests* | Alerts | All Projects |
| `regression/01.reg_alerts_admin.cy.ts` | Regression: Monitoring - Alerts Namespaced (Administrator) | *Runs All Regression Alerts Tests (Namespace)* | Alerts | openshift-monitoring |
| | | | | |
| `regression/02.reg_metrics_admin.cy.ts` | Regression: Monitoring - Metrics (Administrator) | *Runs All Regression Metrics Tests* | Metrics | All Projects |
| `regression/02.reg_metrics_admin.cy.ts` | Regression: Monitoring - Metrics Namespaced (Administrator) | *Runs All Regression Metrics Tests (Namespace)* | Metrics | openshift-monitoring |
| | | | | |
| `regression/03.reg_legacy_dashboards_admin.cy.ts` | Regression: Monitoring - Legacy Dashboards (Administrator) | *Runs All Regression Legacy Dashboards Tests* | Dashboards | All Projects |
| `regression/03.reg_legacy_dashboards_admin.cy.ts` | Regression: Monitoring - Legacy Dashboards Namespaced (Administrator) | *Runs All Regression Legacy Dashboards Tests (Namespace)* | Dashboards | openshift-monitoring |

---

## Support Module Test Scenarios

These test scenarios are reusable test suites called by the main E2E test files.

### Alerts Tests

#### Non-Namespaced Alerts (`01.reg_alerts.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Alerting > Alerts page - Filtering` | Tests all filtering options: Alert State, Severity, Source filters; Export CSV; Search by name and label |
| `{perspective} perspective - Alerting > Silences page > Create silence` | Tests silence creation form validation: comment validation, creator validation, label name/value validation |
| `{perspective} perspective - Alerting > Alerts / Silences > Kebab icon on List and Details` | Comprehensive test covering: silence creation, silence expiration, kebab menu actions on alerts and silences, recreate/edit silence functionality |
| `{perspective} perspective - Alerting > Alerting Rules` | Tests alerting rules page: filtering, searching, silence creation from alerting rule, kebab menu validation |

#### Namespaced Alerts (`04.reg_alerts_namespace.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Alerting > Alerts page - Filtering` | Same as non-namespaced but validates Source filter is not available in namespace scope |
| `{perspective} perspective - Alerting > Silences page > Create silence` | Tests silence creation with namespace scope validation (namespace label should be disabled) |
| `{perspective} perspective - Alerting > Alerts / Silences > Kebab icon on List and Details` | Same comprehensive tests as non-namespaced with namespace context |
| `{perspective} perspective - Alerting > Alerting Rules` | Same alerting rules tests with namespace scope |
| `{perspective} perspective - Alerting > Empty state` | Tests empty state for Alerts, Silences, and Alerting Rules when switching to empty namespace |

### Metrics Tests

#### Non-Namespaced Metrics (`02.reg_metrics.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Metrics` | Validates Metrics page loading, Units dropdown, Refresh interval, Actions dropdown, Predefined queries, Kebab menu |
| `{perspective} perspective - Metrics > Actions - No query added` | Tests Add query, Collapse/Expand all queries, Delete all queries when no query is entered |
| `{perspective} perspective - Metrics > Actions - One query added` | Tests same actions with an active query loaded |
| `{perspective} perspective - Metrics > Insert Example Query` | Tests example query insertion, graph timespan dropdown/input, Reset zoom, Hide/Show graph, Stacked/Disconnected checkbox |
| `{perspective} perspective - Metrics > Add Query - Run Queries - Kebab icon` | Comprehensive test: Add/run queries, Disable/Enable query via kebab and switch, Hide/Show all series, Select/Unselect series, Delete/Duplicate query |
| `{perspective} perspective - Metrics > Predefined Queries > Export as CSV` | Tests CSV export for all 9 predefined queries (CPU, Memory, Filesystem, Network metrics) |
| `{perspective} perspective - Metrics > Ungraphable results` | Tests ungraphable results error state when too many queries are added |
| `{perspective} perspective - Metrics > No Datapoints` | Tests empty state when query returns no data |
| `{perspective} perspective - Metrics > No Datapoints with alert` | Tests error alert display for invalid queries |

#### Namespaced Metrics (`05.reg_metrics_namespace.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| All scenarios from non-namespaced | Same 9 test scenarios as non-namespaced metrics |
| `{perspective} perspective - Metrics > Empty state` | Additional test for empty state when switching to empty namespace |

**Total Metrics Scenarios:** 9 (non-namespaced), 10 (namespaced)

### Legacy Dashboards Tests

#### Non-Namespaced Legacy Dashboards (`03.reg_legacy_dashboards.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Dashboards (legacy)` | Tests dashboard page loading, time range dropdown, refresh interval, dashboard dropdown, API Performance dashboard panels, Inspect functionality |
| `{perspective} perspective - Dashboards (legacy) - Inspect and Export as CSV` | Tests Export CSV functionality and disabled state for empty data |
| `{perspective} perspective - Dashboards (legacy) - No kebab dropdown` | Validates that Single Stat and Table panels don't show kebab menu |
| `{perspective} perspective - OU-897 - Hide Graph / Show Graph on Metrics, Alert Details and Dashboards` | Tests Hide/Show graph state persistence across Metrics, Dashboards, Alert details, and Alerting rule details pages |

#### Namespaced Legacy Dashboards (`06.reg_legacy_dashboards_namespace.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Dashboards (legacy)` | Tests Kubernetes Compute Resources Namespace Pods dashboard with namespace scope |
| `{perspective} perspective - Dashboards (legacy) - Export as CSV` | Tests CSV export with namespace scope and empty state validation |
| `{perspective} perspective - Dashboards (legacy) - No kebab dropdown` | Validates kebab menu absence for specific chart types |
| `{perspective} perspective - OU-897 - Hide Graph / Show Graph on Metrics, Alert Details and Dashboards` | Same Hide/Show graph tests with namespace context |

### BVT Monitoring Tests

#### Non-Namespaced BVT (`00.bvt_monitoring.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Alerting > Alerting Details page > Alerting Rule > Metrics` | Tests full navigation flow: Alerts list → Alert details → Alerting rule details → Metrics page, validates expression query |
| `{perspective} perspective - Creates and expires a Silence` | Tests complete silence lifecycle: creation, validation on multiple pages (Alerts, Silences, Alerting Rules), expiration |

#### Namespaced BVT (`00.bvt_monitoring_namespace.cy.ts`)

| Test Scenario | Description |
|---------------|-------------|
| `{perspective} perspective - Alerting > Alerting Details page > Alerting Rule > Metrics` | Same flow as non-namespaced with namespace scope validation |
| `{perspective} perspective - Creates and expires a Silence` | Same silence lifecycle with namespace scope, validates namespace label is disabled in forms |

---

## Test Statistics Summary

| Category | Test Files | Direct it() Scenarios | Support Module Scenarios | Total Scenarios |
|----------|------------|----------------------|-------------------------|-----------------|
| **COO Tests** | 1 | 1 | 0 | 1 |
| **Virtualization Tests** | 4 | 6 | ~30+ (via support modules) | ~36+ |
| **Monitoring Tests** | 4 | 9 | ~30+ (via support modules) | ~39+ |
| **Support Modules** | 8 | 0 | 39 | 39 |
| **TOTAL** | **20** | **29** | **39** | **~128+** |

---

## Perspectives Tested

- **Administrator** - Standard admin perspective with full cluster access
- **Virtualization** - Virtualization-specific perspective with integrated monitoring

## Namespace Scopes

- **All Projects** - Cluster-wide monitoring across all namespaces
- **openshift-monitoring** - Namespace-scoped monitoring for core monitoring components
- **default** - Used for testing empty state scenarios

---

## Notes

1. **Support Module Tests**: Test scenarios marked with *Runs X Tests* are implemented in support files and called by the main E2E test files with different perspectives.

2. **Perspective Parameter**: `{perspective}` is dynamically replaced with the actual perspective name (Administrator, Virtualization) when tests run.

3. **Empty State Tests**: Namespaced tests include additional empty state validation by switching to empty namespaces like `default`.

