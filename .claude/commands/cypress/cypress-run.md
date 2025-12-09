---
name: cypress-run 
description: Display Cypress test commands - choose execution mode (headless recommended)
parameters:
  - name: execution-mode
    description: Choose execution mode - headless (recommended), headed, or interactive
    required: true
    type: string
---

# Cypress Test Commands

**Prerequisites**: Run `/cypress-setup` first to configure your environment.

**Note**: These commands assume you're already in the `web/cypress` directory (automatically set by `/cypress-setup`).

---

## 🎯 Execution Modes

1. **🤖 Headless** (Recommended) - Fast, automated testing without visible browser
2. **👁️ Headed** - Watch tests execute in visible browser for debugging  
3. **🎮 Interactive** - Visual UI to pick and run tests manually

---

**Instructions**: Based on the `execution-mode` parameter provided by the user:
- If `execution-mode` is "headless": Display ONLY the "🤖 Headless Mode Commands" section below
- If `execution-mode` is "headed": Display ONLY the "👁️ Headed Mode Commands" section below
- If `execution-mode` is "interactive": Display ONLY the "🎮 Interactive Mode" section below

Copy the commands you want to run in your **"cypress-monitoring"** terminal.

---

# 🎮 Interactive Mode

**Cypress Interactive Test Runner** - Pick and run tests visually with Cypress UI.

## What is Interactive Mode?

Interactive mode opens the Cypress Test Runner UI where you can:
- ✅ Browse and select tests visually
- ✅ Watch tests run in real-time with time-travel debugging
- ✅ Inspect DOM snapshots at each step
- ✅ See detailed command logs
- ✅ Rerun tests with a single click
- ✅ Perfect for test development and debugging

## Command

**Open Cypress Interactive UI:**
```bash
npm run cypress:open
```

This opens a visual interface where you can:
1. Choose a browser (Chrome, Firefox, Edge, Electron)
2. Browse your test files
3. Click any test to run it
4. Watch it execute step-by-step
5. Debug failures interactively

## Benefits

- **Visual Testing**: See exactly what's happening
- **Fast Iteration**: Make changes and rerun instantly
- **Easy Debugging**: Inspect any step of your test
- **Browser DevTools**: Full access to browser debugging tools
- **Selector Playground**: Helps you write better selectors

## When to Use

- 🔍 Developing new tests
- 🐛 Debugging test failures
- 📚 Learning how tests work
- 🎨 Demonstrating tests to others

---

# 🤖 Headless Mode Commands

All commands below run tests in headless mode (no visible browser).

## ⚡ Quick Start - Headless

**Fast Smoke Test (1-2 min, excludes slow/demo/flaky):**
```bash
npm run test-cypress-fast
```

**Full Smoke Suite (5-10 min, excludes flaky):**
```bash
npm run test-cypress-smoke
```

**Console Test (headless):**
```bash
npm run test-cypress-console-headless
```

---

## 📦 Complete Test Suites - Headless (from package.json)

### Monitoring Plugin Tests

**All Monitoring Tests (excludes flaky):**
```bash
npm run test-cypress-monitoring
```

**Monitoring Dev Tests:**
```bash
npm run test-cypress-monitoring-dev
```

**Monitoring BVT (smoke only):**
```bash
npm run test-cypress-monitoring-bvt
```

**Monitoring Regression (excludes smoke and flaky):**
```bash
npm run test-cypress-monitoring-regression
```

### Feature-Specific Tests

**Alerts (excludes flaky):**
```bash
npm run test-cypress-alerts
```

**Metrics (excludes flaky):**
```bash
npm run test-cypress-metrics
```

**Dashboards - Legacy (excludes flaky):**
```bash
npm run test-cypress-dashboards
```

**Perses Dashboards (excludes flaky):**
```bash
npm run test-cypress-perses
```

### COO (Observability Operator) Tests

**COO - All Tests (excludes flaky):**
```bash
npm run test-cypress-coo
```

**COO BVT (smoke only):**
```bash
npm run test-cypress-coo-bvt
```

### Integration Tests

**ACM (Advanced Cluster Management, excludes flaky):**
```bash
npm run test-cypress-acm
```

**Virtualization (30-40 min, excludes flaky):**
```bash
npm run test-cypress-virtualization
```

**Incidents (excludes flaky):**
```bash
npm run test-cypress-incidents
```

---

## 🏷️ Custom Tag Combinations - Headless

**Base command for custom tags:**
```bash
npm run cypress:run -- --env grepTags="YOUR_TAGS_HERE"
```

### Popular Tag Combinations:

**Alerts tests:**
```bash
npm run cypress:run -- --env grepTags="@alerts"
```

**Metrics tests:**
```bash
npm run cypress:run -- --env grepTags="@metrics"
```

**Dashboards tests:**
```bash
npm run cypress:run -- --env grepTags="@dashboards"
```

**Perses tests:**
```bash
npm run cypress:run -- --env grepTags="@perses"
```

**All smoke tests (fastest, excludes slow/flaky):**
```bash
npm run cypress:run -- --env grepTags="@smoke --@slow --@flaky"
```

**Monitoring without smoke tests:**
```bash
npm run cypress:run -- --env grepTags="@monitoring --@smoke"
```

**COO smoke tests:**
```bash
npm run cypress:run -- --env grepTags="@coo+@smoke"
```

**Virtualization smoke tests:**
```bash
npm run cypress:run -- --env grepTags="@virtualization+@smoke"
```

---

## 🎪 Specific Test Files - Headless

### Monitoring Tests

**Monitoring BVT (Admin):**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"
```

**Monitoring BVT (Dev User):**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/00.bvt_dev.cy.ts"
```

**Alerts - Admin User:**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/regression/01.reg_alerts_admin.cy.ts"
```

**Alerts - Dev User:**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/regression/01.reg_alerts_dev.cy.ts"
```

**Metrics Tests:**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/regression/02.reg_metrics_admin_1.cy.ts"
```

```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/regression/02.reg_metrics_admin_2.cy.ts"
```

**Dashboards Tests:**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/regression/03.reg_legacy_dashboards_admin.cy.ts"
```

### COO Tests

**COO BVT:**
```bash
npm run cypress:run -- --spec "cypress/e2e/coo/01.coo_bvt.cy.ts"
```

**COO Alerts (headed):**
```bash
npm run cypress:run -- --spec "cypress/e2e/coo/02.acm_alerting_ui.cy.ts"
```

### Perses Tests

**Perses Dashboard:**
```bash
npm run cypress:run -- --spec "cypress/e2e/perses/01.coo_perses.cy.ts"
```

### Virtualization Tests

**Virtualization - Alerts:**
```bash
npm run cypress:run -- --spec "cypress/e2e/virtualization/01.coo_ivt_alerts.cy.ts"
```

**Virtualization - Metrics 1:**
```bash
npm run cypress:run -- --spec "cypress/e2e/virtualization/02.coo_ivt_metrics_1.cy.ts"
```

**Virtualization - Metrics 2:**
```bash
npm run cypress:run -- --spec "cypress/e2e/virtualization/02.coo_ivt_metrics_2.cy.ts"
```

**Virtualization - Dashboards:**
```bash
npm run cypress:run -- --spec "cypress/e2e/virtualization/03.coo_ivt_legacy_dashboards.cy.ts"
```

**Virtualization - Perses:**
```bash
npm run cypress:run -- --spec "cypress/e2e/virtualization/04.coo_ivt_perses.cy.ts"
```

### Multiple Files

**Run multiple spec files:**
```bash
npm run cypress:run -- --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts,cypress/e2e/coo/01.coo_bvt.cy.ts"
```

---

## 🔧 Advanced Headless Options

**Run with Firefox (headless):**
```bash
npm run cypress:run -- --browser firefox
```

**Run with Edge (headless):**
```bash
npm run cypress:run -- --browser edge
```

**Disable video recording:**
```bash
npm run cypress:run -- --config video=false
```

**Disable screenshots:**
```bash
npm run cypress:run -- --config screenshotOnRunFailure=false
```

---

# 👁️ Headed Mode Commands

All commands below open a visible browser window.

## ⚡ Quick Start - Headed

**Interactive Mode (Cypress UI, pick tests manually):**
```bash
npm run cypress:open
```

**Console Test (opens browser):**
```bash
npm run test-cypress-console
```

**Base headed mode command:**
```bash
npm run cypress:run -- --headed
```

---

## 📦 Complete Test Suites - Headed

### Monitoring Plugin Tests

**All Monitoring Tests (headed, excludes flaky):**
```bash
npm run cypress:run -- --headed --env grepTags="@monitoring --@flaky"
```

**Monitoring BVT (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@monitoring+@smoke"
```

**Monitoring Regression (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@monitoring --@smoke --@flaky"
```

### Feature-Specific Tests

**Alerts (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@alerts --@flaky"
```

**Metrics (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@metrics --@flaky"
```

**Dashboards (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@dashboards --@flaky"
```

**Perses (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@perses --@flaky"
```

### COO Tests

**COO All Tests (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@coo --@flaky"
```

**COO BVT (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@coo+@smoke"
```

### Integration Tests

**Virtualization (headed, 30-40 min):**
```bash
npm run cypress:run -- --headed --env grepTags="@virtualization --@flaky"
```

**ACM (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@acm --@flaky"
```

**Incidents (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@incidents --@flaky"
```

---

## 🏷️ Custom Tag Combinations - Headed

**Smoke tests (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@smoke --@slow --@flaky"
```

**Alerts smoke (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@alerts"
```

**Metrics smoke (headed):**
```bash
npm run cypress:run -- --headed --env grepTags="@metrics"
```

**Dashboards Tests:**
```bash
npm run cypress:run -- --headed --env grepTags="@dashboards"
```

---

## 🎪 Specific Test Files - Headed

### Monitoring Tests

**Monitoring BVT (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"
```

**Alerts Admin (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/monitoring/regression/01.reg_alerts_admin.cy.ts"
```

**Metrics (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/monitoring/regression/02.reg_metrics_admin_1.cy.ts"
```

```bash
npm run cypress:run -- --headed --spec "cypress/e2e/monitoring/regression/02.reg_metrics_admin_2.cy.ts"
```

**Dashboards (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/monitoring/regression/03.reg_legacy_dashboards.cy.ts"
```

### COO Tests

**COO BVT (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/coo/01.coo_bvt.cy.ts"
```

**COO Alerts (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/coo/02.acm_alerting_ui.cy.ts"
```

### Virtualization Tests

**Virtualization Alerts (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/virtualization/01.coo_ivt_alerts.cy.ts"
```

**Virtualization Metrics (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/virtualization/02.coo_ivt_metrics_1.cy.ts"
```

```bash
npm run cypress:run -- --headed --spec "cypress/e2e/virtualization/02.coo_ivt_metrics_2.cy.ts"
```

**Virtualization Dashboads (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/virtualization/03.coo_ivt_legacy_dashboards.cy.ts"
```

**Perses Dashboard (headed):**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/perses/01.coo_perses.cy.ts"
```

---

## 🔧 Advanced Headed Options

**Headed with specific browser:**
```bash
npm run cypress:run -- --headed --browser chrome
npm run cypress:run -- --headed --browser firefox
npm run cypress:run -- --headed --browser edge
```

**Headed without video:**
```bash
npm run cypress:run -- --headed --config video=false
```

**Slow motion (for demos):**
```bash
cypress run --headed --slow 500 --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"
```

---

## 📋 Available Tags Reference

Use these tags with `--env grepTags`:

- `@monitoring` - Core monitoring plugin tests
- `@monitoring-dev` - Developer user tests
- `@alerts` - Alert-related tests
- `@metrics` - Metrics explorer tests
- `@dashboards` - Legacy dashboard tests
- `@perses` - Perses dashboard tests
- `@coo` - Observability Operator tests
- `@acm` - Advanced Cluster Management tests
- `@virtualization` - OpenShift Virtualization tests
- `@incidents` - Incidents feature tests
- `@smoke` - Quick smoke tests
- `@slow` - Longer running tests
- `@flaky` - Known flaky tests
- `@demo` - Demo/showcase tests

**Tag Operators:**
- `+` = AND (e.g., `@alerts+@smoke` = alerts AND smoke)
- `--` = NOT (e.g., `@monitoring --@flaky` = monitoring but NOT flaky)
- `,` = OR (e.g., `@alerts,@metrics` = alerts OR metrics)

---

## 🔗 Related Commands

- **`/cypress-setup`** - Configure testing environment

---

## 📚 Documentation

- `web/cypress/README.md` - Setup and execution guide
- `web/cypress/E2E_TEST_SCENARIOS.md` - Complete test catalog
- `web/cypress/CYPRESS_TESTING_GUIDE.md` - Testing best practices