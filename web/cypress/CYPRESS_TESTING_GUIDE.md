# Cypress Testing Guide - Monitoring Plugin

> **Complete guide for developers and AI agents on Cypress E2E testing**

---

## Table of Contents
- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Creating Tests](#creating-tests)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Node.js >= 18
- OpenShift cluster with kubeconfig
- Environment variables configured

### 30-Second Setup
```bash
cd web/cypress
source ./configure-env.sh  # Interactive configuration
npm install                 # Install dependencies
npm run cypress:open           # Start testing
```

**For detailed setup instructions and environment configuration, see [README.md](README.md)**

---

## Test Architecture

### 3-Layer Organization

The Monitoring Plugin uses a 3-layer architecture for test organization:

```
┌─────────────────────────────────────────────────┐
│ Layer 3: E2E Test Files                        │
│ (cypress/e2e/)                                  │
│ - Call support scenarios                        │
│ - Specify perspective (Administrator, etc.)    │
└────────────────┬────────────────────────────────┘
                 │ imports
┌────────────────▼────────────────────────────────┐
│ Layer 2: Support Scenarios                     │
│ (cypress/support/monitoring or perses          │
│ - Reusable test scenarios                      │
│ - Work across multiple perspectives            │
│ - Export functions with perspective parameter  │
└────────────────┬────────────────────────────────┘
                 │ uses
┌────────────────▼────────────────────────────────┐
│ Layer 1: Page Object Views                     │
│ (cypress/views/)                                │
│ - Reusable UI actions                          │
│ - Navigation, clicks, assertions               │
│ - Use data-test attributes                     │
└─────────────────────────────────────────────────┘
```

### File Structure

```
cypress/
├── e2e/
│   ├── monitoring/           # Core monitoring tests (Administrator)
│   │   ├── 00.bvt_admin.cy.ts
│   │   └── regression/
│   ├── coo/                  # COO-specific tests
│   │   ├── 01.coo_bvt.cy.ts
│   │   └── 02.acm_alerting_ui.cy.ts
│   └── virtualization/       # Integration tests (Virtualization)
├── support/
│   ├── monitoring/           # Reusable test scenarios
│   │   ├── 01.reg_alerts.cy.ts
│   │   ├── 02.reg_metrics.cy.ts
│   │   └── 03.reg_legacy_dashboards.cy.ts
│   ├── perses/               # COO/Perses scenarios
│   └── commands/             # Custom Cypress commands
└── views/                    # Page object models (reusable actions)
```

**Benefits**:
- Test scenarios reusable across Administrator, Virtualization, and Fleet Management perspectives
- Page actions separated from test logic for better maintainability
- UI changes only require updating views, not individual tests

---

## Creating Tests

### Workflow

1. **Layer 1 - Views**: Check/add page actions in `cypress/views/`
   - Under `views/` folder, find pre-defined actions per page
   - If none fits your needs, add new ones
   
2. **Layer 2 - Support**: Add test scenarios to `cypress/support/monitoring/`
   - Add test scenarios to cypress files under `support/` folder
   - Make scenarios reusable across perspectives (Administrator, Virtualization, Fleet Management)
   - If it is not applicable, in some cases for Incidents or Fleet Management, test scenarios will be written directly into Layer 3
   
3. **Layer 3 - E2E**: Verify e2e files call your scenario (usually pre-configured)
   - Administrator: `e2e/monitoring/`
   - Virtualization: `e2e/virtualization/`
   - Fleet Management: `e2e/coo/` (for ACM)

### Example: Support Scenario Structure

```typescript
// In support/monitoring/01.reg_alerts.cy.ts
import { nav } from '../../views/nav';
import { silencesListPage } from '../../views/silences-list-page';

export const runAlertTests = (perspective: string) => {
  describe(`${perspective} perspective - Alerting > Alerts page`, () => {

    it('should filter alerts by severity', () => {
      // Use page object actions from views/
      silencesListPage.filter.byName('test-alert');
      silencesListPage.rows.shouldBe('test-alert', 'Active');
    });
  });
};
```

### When to Create New Tests

| Scenario | Action |
|----------|--------|
| New UI feature | Create new test scenario in support/ |
| Bug fix | Add test case to existing support file |
| Component update | Update existing test scenarios |
| New Perses feature | Create new test scenario in support/ |
| ACM integration | Add test in e2e/coo/ |

### Best Practices

1. **Use Page Objects**: Import actions from `cypress/views/`
2. **Data Test Attributes**: Prefer `data-test` over CSS selectors
3. **Keep Tests Isolated**: Each test should run independently
4. **Meaningful Assertions**: Use descriptive error messages
5. **Document Changes**: Update `E2E_TEST_SCENARIOS.md`

---

## Running Tests

### Common Commands

```bash
cd web/cypress

# Run all regression tests
npm run cypress:run --spec "cypress/e2e/**/regression/**"

# Run specific feature regression
npm run cypress:run --spec "cypress/e2e/monitoring/regression/01.reg_alerts_admin.cy.ts"
npm run cypress:run --spec "cypress/e2e/monitoring/regression/02.reg_metrics_admin.cy.ts"
npm run cypress:run --spec "cypress/e2e/monitoring/regression/03.reg_legacy_dashboards_admin.cy.ts"

# Run BVT (Build Verification Tests)
npm run cypress:run --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"

# Run COO tests
npm run cypress:run --spec "cypress/e2e/coo/01.coo_bvt.cy.ts"

# Run ACM Alerting tests
npm run cypress:run --spec "cypress/e2e/coo/02.acm_alerting_ui.cy.ts"

# Interactive mode (GUI)
npm run cypress:open
```

### Environment Setup

**Interactive** (Recommended):
```bash
cd web/cypress
source ./configure-env.sh
```

**Manual Setup**: For complete environment variable reference and configuration examples, see [README.md](README.md#environment-variables-reference)

### Regression Testing Strategy

| Change Type | Required Tests |
|-------------|---------------|
| **UI Component Change** | Feature-specific regression + BVT |
| **API Integration Change** | Full regression suite |
| **Console Extension Change** | BVT + Navigation tests |
| **Bug Fix** | New test + Related regression |

### Pre-PR Checklist

- [ ] `make lint-frontend` (no errors)
- [ ] `make lint-backend` (no errors)
- [ ] Ran BVT tests locally (all passing)
- [ ] Ran regression tests for affected features (all passing)
- [ ] Created/updated tests for new features or bug fixes
- [ ] Updated `E2E_TEST_SCENARIOS.md` if added new tests

---

## Troubleshooting

### Debugging Failed Tests

1. **Check test videos**: `web/cypress/videos/`
2. **Check screenshots**: `web/cypress/screenshots/`
3. **Run with debug**:
   ```bash
   export CYPRESS_DEBUG=true
   npm run cypress:run
   ```
4. **Run interactively**:
   ```bash
   npm run cypress:open
   ```

### Common Test Issues

| Issue | Solution |
|-------|----------|
| Test fails intermittently | Check for timing issues, add proper waits |
| Element not found | Verify data-test attributes exist, check page object |
| Assertion fails | Review expected vs actual values, update test |
| Test hangs | Check for infinite loops or missing assertions |

### Setup & Configuration Issues

For environment variable issues, login problems, kubeconfig errors, and installation troubleshooting, see [README.md](README.md#troubleshooting-setup-issues)

### CI/CD Integration

Cypress tests run automatically in the CI pipeline:
- **Pre-merge**: BVT tests run on every PR
- **Post-merge**: Full regression suite runs on main branch
- **Konflux Pipeline**: Automated testing for release candidates

---

## Additional Resources

- **Cypress Documentation**: https://docs.cypress.io/
- **Test Scenarios Catalog**: `E2E_TEST_SCENARIOS.md`
- **Setup Instructions**: `README.md`
- **Main Guide**: `../../AGENTS.md`

