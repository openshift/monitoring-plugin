---
name: setup
description: Automated Cypress environment setup with direct configuration
parameters: []
---

# Cypress Environment Setup

This command sets up the Cypress testing environment by checking prerequisites, installing dependencies, and configuring environment variables.

## Instructions for Claude

Follow these steps in order:

### Step 1: Check Prerequisites

1. **Check Node.js version** - Required: >= 18
   - Run `node --version` and verify it's >= 18
   - If not, inform the user they need to install Node.js 18 or higher

### Step 2: Navigate and Install Dependencies

1. **Navigate to the cypress directory**:
   ```bash
   cd web/cypress
   ```

2. **Install npm dependencies**:
   ```bash
   npm install
   ```

### Step 3: Create or Update Environment Configuration

**Important**: Do NOT run the interactive `configure-env.sh` script. Instead, create the `web/cypress/export-env.sh` file directly.

1. Check if `web/cypress/export-env.sh` already exists
2. If it exists, read it and show the current values to the user. Ask if they want to keep or update them.
3. Look for cluster credentials in the following order:
   - **Conversation context**: Check if the user already provided a console URL and kubeadmin password earlier in the conversation
   - **Existing export-env.sh**: Reuse values from an existing file if the user confirms they're current
   - **Ask the user directly**: If no credentials are found, ask the user to provide:
     - Console URL (e.g., `https://console-openshift-console.apps.ci-ln-xxxxx.aws-4.ci.openshift.org`)
     - Kubeadmin password
   - **Do NOT proceed without credentials** — the file cannot be created with placeholder values
4. Write the file directly:

```bash
cat > web/cypress/export-env.sh << 'ENVEOF'
# shellcheck shell=bash
export CYPRESS_BASE_URL='<console-url>'
export CYPRESS_LOGIN_IDP='kube:admin'
export CYPRESS_LOGIN_USERS='kubeadmin:<password>'
export CYPRESS_KUBECONFIG_PATH='/tmp/kubeconfig'
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='true'
export CYPRESS_SKIP_KBV_INSTALL='true'
export CYPRESS_KBV_UI_INSTALL='false'
export CYPRESS_TIMEZONE='UTC'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
export CYPRESS_DEBUG='false'
ENVEOF
```

Notes on the values:
- `CYPRESS_BASE_URL`: The OpenShift console URL from the cluster provisioning output
- `CYPRESS_LOGIN_USERS`: Format is `kubeadmin:<password>` using the password from cluster provisioning
- `CYPRESS_KUBECONFIG_PATH`: Use `/tmp/kubeconfig` when running in a Docker sandbox, or the actual path to kubeconfig on the host
- `CYPRESS_SKIP_ALL_INSTALL='false'`: Ensures operators get installed on first run
- `CYPRESS_COO_UI_INSTALL='true'`: Installs the Cluster Observability Operator UI plugin

### Step 4: Verify the setup

Source the file and confirm the variables are set:

```bash
source web/cypress/export-env.sh
echo "Base URL: $CYPRESS_BASE_URL"
```

### Step 5: Inform the user

Let the user know the environment is configured and they can run tests using `/cypress:run`.

---
