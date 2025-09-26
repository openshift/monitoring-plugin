#!/bin/bash

# non-admin user
# export CYPRESS_BASE_URL=https://<console_route_spec_host>
# export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
# export CYPRESS_LOGIN_USERS=username:password
# export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig

# kubeadmin user
export CYPRESS_BASE_URL=https://<console_route_spec_host>
export CYPRESS_LOGIN_IDP=kube:admin
export CYPRESS_LOGIN_USERS=kubeadmin:<password>
export CYPRESS_KUBECONFIG_PATH=~/Downloads/kubeconfig

# Set the following var to use custom Monitoring Plugin image (that goes on Cluster Monitoring Operator). The image will be patched in CMO CSV.
export CYPRESS_MP_IMAGE=<Monitoring Plugin image>

# Set the var to skip Cluster Observability and all the required operators installation.
export CYPRESS_SKIP_COO_INSTALL=false

# Set the var to install Cluster Observability from redhat-operators catalog source.
export CYPRESS_COO_UI_INSTALL=false

# Set the var to install Cluster Observability Operator using Konflux bundle.
# export CYPRESS_KONFLUX_COO_BUNDLE_IMAGE=<COO image>

# Set the var to use custom Cluster Observability Operator bundle image
# export CYPRESS_CUSTOM_COO_BUNDLE_IMAGE=<COO bundle image>

# Set the var to use Cluster Observability Operator FBC image
export CYPRESS_FBC_STAGE_COO_IMAGE=<COO FBC image>

# Set the following var to use custom Monitoring Console Plugin UI plugin image. The image will be patched in Cluster Observability Operator CSV.
export CYPRESS_MCP_CONSOLE_IMAGE=<Monitoring Console Plugin image>

# Set the following var to specify the cluster timezone for incident timeline calculations. Defaults to UTC if not specified.
export CYPRESS_TIMEZONE=<timezone>

# Set the following var to transform old metric names to new format in mocks (for testing against locally built instances)
export CYPRESS_MOCK_NEW_METRICS=false

# Set the following var to enable Cypress session management for faster test execution.
export CYPRESS_SESSION=true
