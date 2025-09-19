# Openshift Monitoring Plugin and Monitoring Console Plugin UI Tests
These console tests are related to Monitoring Plugin deployed by Cluster Monitoring Operator (CMO) as part of OCP - Observe menu with Alerting, Metrics, Dashboards pages and other related Alerting links.
Besides, Monitoring Console Plugin deployed by Cluster Observability Operator through Monitoring UIPlugin installation. 

## Prerequisite
1. [node.js](https://nodejs.org/) >= 18


## Install dependencies
All required dependencies are defined in `package.json` in order to run Cypress tests, run `npm install` so that dependencies will be installed in `node_modules` folder
```bash
$ npm install
$ ls -ltr
node_modules/     -> dependencies will be installed at runtime here
```

## Running locally

### Export necessary variables
in order to run Cypress tests, we need to export some environment variables that Cypress can read then pass down to our tests, currently we have following environment variables defined and used. 

Using a non-admin user.
```bash
export CYPRESS_BASE_URL=https://<console_route_spec_host>
export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
export CYPRESS_LOGIN_USERS=username:password
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig
```
Using kubeadmin user.
```bash
export CYPRESS_BASE_URL=https://<console_route_spec_host>
export CYPRESS_LOGIN_IDP=kube:admin
export CYPRESS_LOGIN_USERS=kubeadmin:password
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig
```
Set the following var to use custom Monitoring Plugin image (that goes on Cluster Monitoring Operator). The image will be patched in CMO CSV.
```bash
export CYPRESS_MP_IMAGE=<Monitoring Plugin image>
```

Set the var to skip Cluster Observability and all the required operators installation.
```bash
export CYPRESS_SKIP_COO_INSTALL=true
```

Set the var to install Cluster Observability Operator from redhat-operators catalog source.
```bash
export CYPRESS_COO_UI_INSTALL=true
```

Set the var to install Cluster Observability Operator using Konflux bundle.
```bash
export CYPRESS_KONFLUX_COO_BUNDLE_IMAGE=<COO image>
```
Set the var to use custom Cluster Observability Operator bundle image.
```bash
export CYPRESS_CUSTOM_COO_BUNDLE_IMAGE=<COO bundle image>
```

Set the following var to use custom Monitoring Console Plugin UI plugin image. The image will be patched in Cluster Observability Operator CSV.
```bash
export CYPRESS_MCP_CONSOLE_IMAGE=<Monitoring Console Plugin image>
```

Set the following var to specify the cluster timezone for incident timeline calculations. Defaults to UTC if not specified.
```bash
export CYPRESS_TIMEZONE=<timezone>
```

Set the following var to enable Cypress session management for faster test execution.
```bash
export CYPRESS_SESSION=true
```

### Environment Configuration Script

The `configure-env.sh` script provides an interactive way to set up all the required environment variables. This script eliminates the need to manually export each variable and helps find the correct kubeconfig file.

**Features:**
- Automatic prompting for all CYPRESS_ variables
- Automatic discovery and numbered selection of `*kubeconfig*` files in `$HOME/Downloads` dir

**Usage:**
```bash
# Note: source command requires Bash shell
source ./configure-env.sh
```
To export variables directly (Bash only).

**File generation**
```bash
./configure-env.sh
```
Creates an export file you can source later. (`source "export-env.sh`)


### Before running cypress
- Make sure cluster's kubeconfig file is located at the correct environment variable / path you have exported
- The file to run Monitoring Plugin tests: bvt.cy.ts
- The file to run Monitoring Console Plugin tests (COO with Monitoring UIPlugin): coo_bvt.cy.ts

### Start Cypress
We can either open Cypress GUI(open) or run Cypress in headless mode(run) to run the tests.
```bash
npx cypress open
npx cypress run
```

To run a specific file
```bash
cd monitoring-plugin/web/cypress
npx cypress run --spec "cypress/e2e/bvt.cy.ts"
npx cypress run --spec "cypress/e2e/coo_bvt.cy.ts"
```

### Testing recording
You can access the recording for your test under monitoring-plugin/web/cypress/videos folder