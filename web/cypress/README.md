# Cypress Setup & Configuration Guide

> **Technical setup and environment configuration for Monitoring Plugin Cypress tests**

For testing workflows, test architecture, and creating tests, see **[CYPRESS_TESTING_GUIDE.md](CYPRESS_TESTING_GUIDE.md)**

---

## Quick Start

```bash
cd web/cypress
npm install                 # Install dependencies
source ./configure-env.sh   # Interactive configuration
npm run cypress:open           # Start Cypress GUI
```

---

## Prerequisites

- **Node.js**: >= 18

---

## Installation

Install Cypress and all dependencies:

```bash
npm install
```

Dependencies are defined in `package.json` and will be installed in `node_modules/`.

---

## Environment Configuration

### Interactive Setup (Recommended)

The `configure-env.sh` script provides an interactive way to set up all required environment variables:

```bash
source ./configure-env.sh
```

**Features**:
- Automatic prompting for all CYPRESS_ variables
- Automatic discovery and numbered selection of `*kubeconfig*` files in `$HOME/Downloads`
- Validates required variables

**Alternative - Generate Export File**:
```bash
./configure-env.sh
```
Creates `export-env.sh` that you can source later: `source export-env.sh`

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CYPRESS_BASE_URL` | OpenShift Console URL | `https://console-openshift-console.apps...` |
| `CYPRESS_LOGIN_IDP` | Identity provider name | `flexy-htpasswd-provider` or `kube:admin` |
| `CYPRESS_LOGIN_USERS` | Login credentials | `username:password` or `kubeadmin:password` |
| `CYPRESS_KUBECONFIG_PATH` | Path to kubeconfig file | `~/Downloads/kubeconfig` |

### Plugin Image Configuration

| Variable | Description | Use Case |
|----------|-------------|----------|
| `CYPRESS_MP_IMAGE` | Custom Monitoring Plugin image | Testing custom MP builds |
| `CYPRESS_MCP_CONSOLE_IMAGE` | Custom Monitoring Console Plugin image | Testing custom MCP builds |

### Operator Installation Control

| Variable | Default | Description |
|----------|---------|-------------|
| `CYPRESS_SKIP_COO_INSTALL` | `false` | Skip Cluster Observability Operator installation |
| `CYPRESS_SKIP_KBV_INSTALL` | `false` | Skip OpenShift Virtualization installation |
| `CYPRESS_SKIP_ALL_INSTALL` | `false` | Skip all operator installations (for pre-provisioned clusters) |
| `CYPRESS_COO_UI_INSTALL` | `false` | Install COO from redhat-operators catalog |
| `CYPRESS_KBV_UI_INSTALL` | `false` | Install Virtualization from redhat-operators catalog |

### Bundle Images

| Variable | Description |
|----------|-------------|
| `CYPRESS_KONFLUX_COO_BUNDLE_IMAGE` | COO bundle image from Konflux |
| `CYPRESS_CUSTOM_COO_BUNDLE_IMAGE` | Custom COO bundle image |
| `CYPRESS_KONFLUX_KBV_BUNDLE_IMAGE` | Virtualization bundle image from Konflux |
| `CYPRESS_CUSTOM_KBV_BUNDLE_IMAGE` | Custom Virtualization bundle image |

### FBC images

| Variable | Description |
|----------|-------------|
| `CYPRESS_FBC_STAGE_COO_IMAGE` | Cluster Observability Operator FBC image |
| `CYPRESS_FBC_STAGE_KBV_IMAGE` | Virtualization FBC image |

### Testing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CYPRESS_SESSION` | `false` | Enable session management for faster execution |
| `CYPRESS_DEBUG` | `false` | Enable debug mode logging in headless mode |

### Incidents Testing Configuration

**Used primarily for Incidents feature testing:**

| Variable | Default | Description |
|----------|---------|-------------|
| `CYPRESS_TIMEZONE` | `UTC` | Cluster timezone for incident timeline calculations |
| `CYPRESS_MOCK_NEW_METRICS` | `false` | Transform old metric names to new format in mocks (temporary workaround for testing against locally built instances) |

**Example:**
```bash
export CYPRESS_TIMEZONE="America/New_York"
export CYPRESS_MOCK_NEW_METRICS=true
```

---

## Configuration Examples

### Example 1: Testing with Non-Admin User

```bash
export CYPRESS_BASE_URL=https://console-openshift-console.apps.cluster.example.com
export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
export CYPRESS_LOGIN_USERS=testuser:testpassword
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig
```

### Example 2: Testing with Kubeadmin

```bash
export CYPRESS_BASE_URL=https://console-openshift-console.apps.cluster.example.com
export CYPRESS_LOGIN_IDP=kube:admin
export CYPRESS_LOGIN_USERS=kubeadmin:admin-password
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig
```

### Example 3: Testing Custom Plugin Build

```bash
# Required variables
export CYPRESS_BASE_URL=https://...
export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
export CYPRESS_LOGIN_USERS=username:password
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig

# Custom image
export CYPRESS_MP_IMAGE=quay.io/myorg/monitoring-plugin:my-branch
export CYPRESS_MCP_CONSOLE_IMAGE=quay.io/myorg/monitoring-console-plugin:my-branch
```

### Example 4: Pre-Provisioned Cluster (Skip Installations)

```bash
# Required variables
export CYPRESS_BASE_URL=https://...
export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
export CYPRESS_LOGIN_USERS=username:password
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig

# Skip installations (cluster already configured)
export CYPRESS_SKIP_ALL_INSTALL=true
```

### Example 5: Debug Mode

```bash
# Required variables + debug
export CYPRESS_DEBUG=true
export CYPRESS_SESSION=true  # Faster test execution
```

---

## Running Cypress

### Interactive Mode (GUI)

Best for test development and debugging:

```bash
npm run cypress:open
```

### Headless Mode (CI-style)

For automated testing:

```bash
npm run cypress:run
```

### Running Specific Tests

```bash
# COO BVT tests
npm run cypress:run --spec "cypress/e2e/coo/01.coo_bvt.cy.ts"

# ACM Alerting tests
npm run cypress:run --spec "cypress/e2e/coo/02.acm_alerting_ui.cy.ts"

# Monitoring BVT tests
npm run cypress:run --spec "cypress/e2e/monitoring/00.bvt_admin.cy.ts"

# All Monitoring Regression tests
npm run cypress:run --spec "cypress/e2e/monitoring/regression/**"

# All Virtualization IVT tests
npm run cypress:run --spec "cypress/e2e/virtualization/**"

# Incidents tests (requires CYPRESS_TIMEZONE and optionally CYPRESS_MOCK_NEW_METRICS)
npm run cypress:run --spec "cypress/e2e/**/incidents*.cy.ts"
```

**Note**: Incidents tests require `CYPRESS_TIMEZONE` to be set to match your cluster's timezone configuration. See [Incidents Testing Configuration](#incidents-testing-configuration) for details.

**For comprehensive test commands and regression testing strategies, see [CYPRESS_TESTING_GUIDE.md](CYPRESS_TESTING_GUIDE.md)**

---

## Test Results

### Videos

Test recordings are saved automatically:
- **Location**: `web/cypress/videos/`
- **Format**: `.mp4`
- **Generated**: For all test runs (pass or fail)

### Screenshots

Screenshots captured on test failures:
- **Location**: `web/cypress/screenshots/`
- **Format**: `.png`
- **Generated**: Only on failures

---

## Troubleshooting Setup Issues

### Issue: Cypress Cannot Find Chrome/Browser

**Solution**: Install Chrome or specify browser
```bash
npm run cypress:open --browser firefox
```

### Issue: Environment Variables Not Set

**Symptoms**: Tests fail with "BASE_URL is not defined"

**Solution**: 
1. Verify variables are exported: `echo $CYPRESS_BASE_URL`
2. Re-run configuration: `source ./configure-env.sh`
3. Ensure you're in the correct shell session

### Issue: Kubeconfig Not Found

**Symptoms**: "ENOENT: no such file or directory"

**Solution**:
```bash
# Check file exists
ls -la $CYPRESS_KUBECONFIG_PATH

# Update path if needed
export CYPRESS_KUBECONFIG_PATH=/correct/path/to/kubeconfig
```

### Issue: Login Fails

**Symptoms**: "User authentication failed"

**Solution**:
1. Verify IDP name: Check OpenShift OAuth configuration
2. Verify credentials are correct
3. For kubeadmin, use `kube:admin` as IDP

### Issue: Tests Are Slow

**Solution**: Enable session management
```bash
export CYPRESS_SESSION=true
```

---

## Test Organization

### Directory Structure

```
cypress/
├── e2e/                    # Test files by perspective
│   ├── monitoring/         # Core monitoring (Administrator)
│   ├── coo/               # COO-specific tests
│   └── virtualization/    # Virtualization integration
├── support/               # Reusable test scenarios
│   ├── monitoring/        # Test scenario modules
│   ├── perses/           # Perses scenarios
│   └── commands/         # Custom Cypress commands
├── views/                # Page object models
├── fixtures/             # Test data and mocks
└── E2E_TEST_SCENARIOS.md # Complete test catalog
```

**For test architecture and creating new tests, see [CYPRESS_TESTING_GUIDE.md](CYPRESS_TESTING_GUIDE.md)**

---

## Documentation

- **Testing Guide**: [CYPRESS_TESTING_GUIDE.md](CYPRESS_TESTING_GUIDE.md) - Complete testing workflows and test creation
- **Test Scenarios**: [E2E_TEST_SCENARIOS.md](./E2E_TEST_SCENARIOS.md) - Catalog of all test scenarios
- **Project Guide**: [AGENTS.md](../../AGENTS.md) - Main developer guide
- **Cypress Docs**: https://docs.cypress.io/ - Official Cypress documentation

---

## Additional Resources

- **Configure Script**: `./configure-env.sh` - Interactive setup
- **Export Script**: `./export-env.sh` - Generated environment file
- **Fixtures**: `./fixtures/` - Test data and mocks
- **Support**: `./support/` - Custom commands and utilities

---

*For questions about test architecture, creating tests, or testing workflows, refer to [CYPRESS_TESTING_GUIDE.md](CYPRESS_TESTING_GUIDE.md)*
