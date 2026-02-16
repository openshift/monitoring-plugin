# Perses E2E Test Scenarios

This document lists all Cypress E2E test scenarios for Perses dashboards with detailed functionality descriptions.

---

## 00.coo_bvt_perses_admin.cy.ts

**Tags:** `@smoke`, `@dashboards`, `@perses`

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - Dashboards (Perses) page` | Navigate to Dashboards (Perses) page, verify page loads correctly, assert time range dropdown, refresh interval dropdown, and dashboard dropdown options. Change namespace to `perses-dev` and verify dashboard list updates. |
| 2 | `2.Administrator perspective - Accelerators common metrics dashboard` | Navigate to Accelerators common metrics dashboard in `openshift-cluster-observability-operator` namespace. Verify cluster variable dropdown is visible, assert panel group header "Accelerators", verify panel headers, expand and collapse "GPU Utilization" panel. |
| 3 | `3.Administrator perspective - Perses Dashboard Sample dashboard` | Navigate to Perses Dashboard Sample in `perses-dev` namespace. Verify variable dropdowns (job, instance, interval, text) are visible. Assert "Row 1" panel group header, expand/collapse "RAM Used" panel, verify stat chart values, search and select variable `job=node-exporter`. |

---

## 00.coo_bvt_perses_admin_1.cy.ts

**Tags:** `@smoke-`, `@dashboards-`, `@perses-` _(disabled - uses list page approach)_

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - Dashboards (Perses) page` | Navigate via list page, click on Accelerators dashboard, verify dashboard loads. |
| 2 | `2.Administrator perspective - Accelerators common metrics dashboard` | Same as above but navigates via list page click instead of dropdown selection. |
| 3 | `3.Administrator perspective - Perses Dashboard Sample dashboard` | Same as above but navigates via list page click instead of dropdown selection. |

---

## 01.coo_list_perses_admin.cy.ts

**Tags:** `@perses`, `@dashboards-`

### Describe 1: COO - Dashboards (Perses) - List perses dashboards

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - List Dashboards (Perses) page` | **Filter by Name:** Filter dashboards by name, verify count=1. **Clear filters.** **Filter by Project and Name:** Filter by `perses-dev` project, verify count=3, add name filter, verify count=1. **Clear filters.** **Sort by Dashboard (Ascending):** Verify order: Accelerators → APM → K8s → Perses Sample → Prometheus → Thanos. **Sort by Dashboard (Descending):** Verify reversed order. **Empty state:** Filter by non-existent name, verify empty state and count=0. **Clear filters.** **Click dashboard:** Click on Thanos Compact Overview dashboard to navigate. |

### Describe 2: COO - Dashboards (Perses) - List perses dashboards - Namespace

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - List Dashboards (Perses) page` | **Namespace: perses-dev:** Change namespace, filter by project, verify count=3, filter by name, verify count=1. **Sort Ascending:** Verify order: Perses Sample → Prometheus → Thanos. **Sort Descending:** Verify reversed order. **Namespace: openshift-cluster-observability-operator:** Change namespace, verify count=3, filter by name, verify count=1. **Sort Ascending:** Verify order: Accelerators → APM → K8s. **Sort Descending:** Verify reversed order. **Empty state:** Filter by `perses-dev` dashboard in COO namespace, verify empty state. **Clear filters.** **Click dashboard:** Click on APM Dashboard to navigate. |

---

## 02.coo_edit_perses_admin.cy.ts

**Tags:** `@perses`, `@dashboards-`

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - Edit perses dashboard page` | Navigate to K8s Compute Resources Cluster dashboard. Click Edit button, verify edit mode buttons appear. Assert panel group buttons for "Headlines". Assert panel action buttons for "CPU Usage" and "CPU Utilisation". Click Cancel, change namespace to All Projects. |
| 2 | `2.Administrator perspective - Edit Toolbar - Edit Variables - Add List Variable` | Navigate to K8s dashboard. Click Edit → Edit Variables → Add Variable. Add list variable with name "ListVariable", enable "Allow All" and "Allow Multiple". Run Query, verify Preview Values appears. Add variable, Apply, Save dashboard. Navigate back, verify variable persists and can select "All". |
| 3 | `3.Administrator perspective - Edit Toolbar - Edit Variables - Add Text Variable` | Navigate to K8s dashboard. Click Edit → Edit Variables. Toggle Dashboard Built-in Variables section. Add Variable → Add text variable "TextVariable" with default value. Add, Apply, Save. Navigate back, verify text variable exists and can type values. |
| 4 | `4.Administrator perspective - Edit Toolbar - Edit Variables - Visibility, Move up/down, Edit and Delete Variable` | Navigate to K8s dashboard. Click Edit → Edit Variables. **Toggle visibility:** Hide first variable. **Move up:** Move second variable up. **Edit:** Edit first variable, rename to "ListVariable123". **Delete:** Delete third variable (TextVariable). Save. Verify renamed variable works, hidden variable not visible, deleted variable doesn't exist. **Recover:** Restore visibility, delete renamed variable, save. Verify cluster variable visible again. |
| 5 | `5.Administrator perspective - Edit Toolbar - Edit Variables - Add Variable - Required field validation` | Navigate to Perses Dashboard Sample. Click Edit → Edit Variables → Add Variable. Clear Name field, click Add. Verify required field validation error for "Name". Cancel dialogs. |
| 6 | `6.Administrator perspective - Edit Toolbar - Add Panel Group` | Navigate to Perses Dashboard Sample. Click Edit → Add Group. Create "PanelGroup1" with state "Open". Save. Verify panel group header appears. Navigate back, verify panel group persists. |
| 7 | `7.Administrator perspective - Edit Toolbar - Edit Panel Group` | Navigate to Perses Dashboard Sample. Click Edit, click edit action on "PanelGroup1". Rename to "PanelGroup2", set state to "Closed". Save. Verify updated panel group. Navigate back, verify changes persist. |
| 8 | `8.Administrator perspective - Edit Toolbar - Move Panel Group Down and Up` | Navigate to Perses Dashboard Sample. Click Edit, move "PanelGroup2" down. Save. **Verify order:** Row 1 (0), PanelGroup2 (1), Row 2 (2). Navigate back, verify order persists. Click Edit, move "PanelGroup2" up. Save. **Verify new order:** PanelGroup2 (0), Row 1 (1), Row 2 (2). Navigate back, verify order persists. |
| 9 | `9.Administrator perspective - Edit Toolbar - Delete Panel Group` | Navigate to Perses Dashboard Sample. Click Edit, click delete action on "PanelGroup2". Confirm deletion. Save. Verify panel group no longer exists. Navigate back, verify deletion persists. |
| 10 | `10.Administrator perspective - Edit Toolbar - Add Panel` | Navigate to Perses Dashboard Sample. **For each panel type (Bar Chart, Gauge Chart, etc.):** Click Edit → Add Group → Create panel group for that type. Click Edit → Add Panel → Create panel of that type in its group. Verify panel appears. Save. |
| 11 | `11.Administrator perspective - Edit Toolbar - Edit Panel` | Navigate to Perses Dashboard Sample. Click Edit. Edit the last panel type, rename to "Panel1", change type to Bar Chart. Save, verify. Edit "Panel1" back to original type. Save, verify. |
| 12 | `12.Administrator perspective - Edit Toolbar - Delete Panel` | Navigate to Perses Dashboard Sample. **For each panel type (in reverse order):** Click Edit, delete the panel. Delete its panel group. Save. |
| 13 | `13.Administrator perspective - Edit Toolbar - Duplicate Panel` | Navigate to Perses Dashboard Sample. Click Edit. Collapse "Row 1" panel group. Click duplicate on "Legend Example" panel. Verify duplicated panel appears (count=2). |
| 14 | `14.Administrator perspective - Edit Toolbar - Add Panel - Required field validation` | Navigate to Perses Dashboard Sample. Click Edit → Add Group → Create "PanelGroup Required Field Validation". Click Add Panel via panel group action. Select type Bar Chart, clear Name field, click Add. Verify required field validation error. Cancel dialogs. |
| 15 | `15.Administrator perspective - Edit Toolbar - Perform changes and Cancel` | Navigate to K8s dashboard. Click Edit. **Add variable:** Add "ListVariable", verify it appears. **Add panel group:** Create "PanelGroup Perform Changes and Cancel". **Add panel:** Create "Panel Perform Changes and Cancel". **Cancel edit mode.** **Verify rollback:** Variable doesn't exist, panel group doesn't exist, panel doesn't exist. |
| 16 | `16.Administrator perspective - Try to editAccelerators and APM dashboards` | Navigate to Accelerators dashboard. Click Edit. Add variable, panel group, and panel. Save. Navigate back, verify changes persist. Click Edit, delete the added variable, panel group, and panel. Save, verify cleanup complete. |

---

## 03.coo_create_perses_admin.cy.ts

**Tags:** `@perses`, `@dashboards-`

| # | Test Name | Functionality |
|---|-----------|---------------|
| 1 | `1.Administrator perspective - Create Dashboard validation with max length` | Click Create button, verify dialog loads. **Project dropdown:** Verify projects available (openshift-cluster-observability-operator, observ-test, perses-dev). **Max length validation:** Select project, enter 76+ character name, click Create, verify max length validation error. **Create dashboard:** Enter valid name with random suffix, click Create, verify dashboard opens in edit mode. |
| 2 | `2.Administrator perspective - Create Dashboard with duplicated name` | Click Create button. Select project, enter dashboard name with random suffix, create. Verify dashboard opens in edit mode. Go back to list, click Create again, enter same dashboard name, click Create. _(Tests duplicate name handling)_ |

---

## 99.coo_rbac_perses_user1.cy.ts

**Tags:** `@smoke-`, `@dashboards-`, `@perses-dev`

**Note:** Tests RBAC permissions for dev user with limited access:
- `openshift-cluster-observability-operator`: persesdashboard-editor-role, persesdatasource-editor-role
- `observ-test`: persesdashboard-viewer-role, persesdatasource-viewer-role  
- `perses-dev`: No access

| # | Test Name | Functionality |
|---|-----------|---------------|
| 5 | `5.Administrator perspective - Create Dashboard validation` | Login as dev user. Click Create button, verify dialog loads. **Project dropdown:** Verify `openshift-cluster-observability-operator` available, `perses-dev` NOT available. Select project, enter dashboard name with random suffix, click Create. Verify dashboard opens in edit mode. |

_(Tests 1-4 are commented out pending bug fixes)_

---

## Summary

| Test File | Active Tests | Total Tests |
|-----------|--------------|-------------|
| `00.coo_bvt_perses_admin.cy.ts` | 3 | 3 |
| `00.coo_bvt_perses_admin_1.cy.ts` | 3 _(disabled)_ | 3 |
| `01.coo_list_perses_admin.cy.ts` | 2 | 2 |
| `02.coo_edit_perses_admin.cy.ts` | 16 | 16 |
| `03.coo_create_perses_admin.cy.ts` | 2 | 2 |
| `99.coo_rbac_perses_user1.cy.ts` | 1 | 1 _(4 commented)_ |
| **Total** | **27** | **27** |

---

## Test Categories

### BVT (Build Verification Tests)
- Basic page loading and navigation
- Dashboard dropdown functionality
- Variable dropdowns and panel interactions

### List Page Tests
- Filter by name
- Filter by project
- Sort ascending/descending
- Empty state handling
- Dashboard navigation via click

### Edit Dashboard Tests
- Enter/exit edit mode
- Variable management (add, edit, delete, reorder, visibility)
- Panel group management (add, edit, delete, move up/down)
- Panel management (add, edit, delete, duplicate)
- Required field validations
- Cancel/Save workflows

### Create Dashboard Tests
- Create dialog validation
- Project dropdown
- Name validation (max length)
- Duplicate name handling

### RBAC Tests
- Permission-based access control
- Editor vs Viewer role differences
- Namespace-level permissions
