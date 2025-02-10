#!/usr/bin/env bash

set -euo pipefail

CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:latest"}
CONSOLE_PORT=${CONSOLE_PORT:=9000}
PLUGIN_PORT=${PLUGIN_PORT:=9001}
CONSOLE_IMAGE_PLATFORM=${CONSOLE_IMAGE_PLATFORM:="linux/amd64"}
npm_package_consolePlugin_name=${npm_package_consolePlugin_name:="monitoring-plugin"}

echo "Starting local OpenShift console..."

BRIDGE_USER_AUTH="disabled"
BRIDGE_K8S_MODE="off-cluster"
BRIDGE_K8S_AUTH="bearer-token"
BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true
BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(oc whoami --show-server)
BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.thanosPublicURL}')
BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.alertmanagerPublicURL}')
BRIDGE_K8S_AUTH_BEARER_TOKEN=$(oc whoami --show-token 2>/dev/null)
BRIDGE_USER_SETTINGS_LOCATION="localstorage"

echo "API Server: $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT"
echo "Console Image: $CONSOLE_IMAGE"
echo "Console URL: http://localhost:${CONSOLE_PORT}"
echo "Console Platform: $CONSOLE_IMAGE_PLATFORM"
echo "Plugin Port: ${PLUGIN_PORT}"

# Prefer podman if installed. Otherwise, fall back to docker.
if [ -x "$(command -v podman)" ]; then
    if [ "$(uname -s)" = "Linux" ]; then
        # Use host networking on Linux since host.containers.internal is unreachable in some environments.
        BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://localhost:${PLUGIN_PORT}"
        podman run --pull always --platform $CONSOLE_IMAGE_PLATFORM \
        --rm --network=host \
        --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY="{\"services\": [{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/perses/\", \"endpoint\":\"http://localhost:8080\",\"authorize\":true}]}" \
        $CONSOLE_IMAGE
    else
        BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.containers.internal:${PLUGIN_PORT}"
        podman run --pull always --platform $CONSOLE_IMAGE_PLATFORM \
        --rm -p "$CONSOLE_PORT":9000 \
        --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY='{"services": [{"consoleAPIPath": "/api/proxy/plugin/monitoring-console-plugin/perses/", "endpoint":"http://host.containers.internal:8080","authorize":true}, {"consoleAPIPath": "/api/proxy/plugin/monitoring-console-plugin/backend/", "endpoint":"http://host.containers.internal:9443","authorize":true} ]}' \
        $CONSOLE_IMAGE
    fi
else
    BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.docker.internal:${PLUGIN_PORT}"
    docker run --pull always --platform $CONSOLE_IMAGE_PLATFORM \
    --rm -p "$CONSOLE_PORT":9000 \
    --env-file <(set | grep BRIDGE) \
    --env BRIDGE_PLUGIN_PROXY='{"services": [{"consoleAPIPath": "/api/proxy/plugin/monitoring-console-plugin/perses/", "endpoint":"http://host.docker.internal:8080","authorize":true, {"consoleAPIPath": "/api/proxy/plugin/monitoring-console-plugin/backend/", "endpoint":"http://host.docker.internal:9443","authorize":true}}]}' \
    $CONSOLE_IMAGE
fi
