#!/usr/bin/env bash

set -euo pipefail

CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:latest"}
CONSOLE_PORT=${CONSOLE_PORT:=9000}
PLUGIN_PORT=${PLUGIN_PORT:=9443}
CONSOLE_IMAGE_PLATFORM=${CONSOLE_IMAGE_PLATFORM:="linux/amd64"}
npm_package_consolePlugin_name=${CONSOLE_PLUGIN_NAME:-"monitoring-plugin"}

# LokiStack gateway for the logging view, reachable via
# `oc -n openshift-logging port-forward svc/logging-loki-gateway-http 8080:8080`
# in a separate terminal. The gateway's public port serves HTTPS with a
# service-CA certificate, so the bridge must trust that CA and connect under
# the service DNS name; --add-host below maps that name to the port-forward.
LOKI_NAME=${LOKI_NAME:-logging-loki}
LOKI_NAMESPACE=${LOKI_NAMESPACE:-openshift-logging}
LOKI_SVC_DNS="${LOKI_NAME}-gateway-http.${LOKI_NAMESPACE}.svc"
LOKI_HOST=${LOKI_HOST:-"https://${LOKI_SVC_DNS}:8080"}
LOKI_CA_FILE="$(pwd)/.loki-service-ca.crt"
BRIDGE_CA_BUNDLE="$(pwd)/.bridge-ca-bundle.crt"
BRIDGE_CA_CONTAINER_FILE="/tmp/bridge-ca-bundle.crt"
if oc -n "${LOKI_NAMESPACE}" get configmap openshift-service-ca.crt \
    -o jsonpath='{.data.service-ca\.crt}' > "${LOKI_CA_FILE}" 2>/dev/null && [ -s "${LOKI_CA_FILE}" ]; then
    # Go's SSL_CERT_FILE replaces the whole trust store, so keep the image's
    # system bundle next to the service CA.
    if [ -x "$(command -v podman)" ]; then ca_runner=podman; else ca_runner=docker; fi
    "${ca_runner}" run --rm --platform "${CONSOLE_IMAGE_PLATFORM}" --entrypoint cat "${CONSOLE_IMAGE}" \
        /etc/pki/tls/certs/ca-bundle.crt > "${BRIDGE_CA_BUNDLE}" 2>/dev/null ||
        { echo "Warning: cannot read the system CA bundle from ${CONSOLE_IMAGE}"; : > "${BRIDGE_CA_BUNDLE}"; }
    cat "${LOKI_CA_FILE}" >> "${BRIDGE_CA_BUNDLE}"
else
    : > "${BRIDGE_CA_BUNDLE}"
    echo "Warning: no service CA found in ${LOKI_NAMESPACE}; the Loki proxy will fail TLS verification"
fi

# Point SSL_CERT_FILE at the bundle only when it has content: an empty file
# would blank the bridge's whole TLS trust store.
if [ -s "${BRIDGE_CA_BUNDLE}" ]; then
    SSL_CERT_ENV="--env SSL_CERT_FILE=${BRIDGE_CA_CONTAINER_FILE}"
else
    SSL_CERT_ENV=""
fi

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
BRIDGE_I18N_NAMESPACES="plugin__${npm_package_consolePlugin_name}"

SA_TOKEN_HOST_FILE="$(pwd)/.monitoring-plugin-bridge-sa-token"
SA_TOKEN_CONTAINER_FILE="/tmp/bridge-sa-token"
printf '%s' "$(oc whoami --show-token 2>/dev/null)" > "${SA_TOKEN_HOST_FILE}"
chmod 600 "${SA_TOKEN_HOST_FILE}"
# The console image runs as UID 1001 and cannot read the 600 token file, so run
# the container as root; under rootless podman container root maps to the
# invoking user, keeping the token private to this account.
BRIDGE_K8S_MODE_OFF_CLUSTER_SERVICE_ACCOUNT_BEARER_TOKEN_FILE="${SA_TOKEN_CONTAINER_FILE}"

echo "API Server: $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT"
echo "Loki gateway: $LOKI_HOST (via local port-forward)"
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
        --rm --network=host --user 0:0 \
        --add-host "${LOKI_SVC_DNS}:127.0.0.1" \
        -v "${SA_TOKEN_HOST_FILE}":"${SA_TOKEN_CONTAINER_FILE}":ro,Z \
        -v "${BRIDGE_CA_BUNDLE}":"${BRIDGE_CA_CONTAINER_FILE}":ro,Z \
        ${SSL_CERT_ENV} \
        --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY="{\"services\": [{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/perses/\", \"endpoint\":\"http://localhost:8080\",\"authorize\":true},{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/loki/\", \"endpoint\":\"${LOKI_HOST}\",\"authorize\":true}]}" \
        $CONSOLE_IMAGE
    else
        BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.containers.internal:${PLUGIN_PORT}"
        podman run --pull always --platform $CONSOLE_IMAGE_PLATFORM \
        --rm -p "$CONSOLE_PORT":9000 --user 0:0 \
        --add-host "${LOKI_SVC_DNS}:host-gateway" \
        -v "${SA_TOKEN_HOST_FILE}":"${SA_TOKEN_CONTAINER_FILE}":ro,Z \
        -v "${BRIDGE_CA_BUNDLE}":"${BRIDGE_CA_CONTAINER_FILE}":ro,Z \
        ${SSL_CERT_ENV} \
        --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY="{\"services\": [{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/perses/\", \"endpoint\":\"http://host.containers.internal:8080\",\"authorize\":true},{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/loki/\", \"endpoint\":\"${LOKI_HOST}\",\"authorize\":true}]}" \
        $CONSOLE_IMAGE
    fi
else
    BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.docker.internal:${PLUGIN_PORT}"
    docker run --pull always --platform $CONSOLE_IMAGE_PLATFORM \
    --rm -p "$CONSOLE_PORT":9000 --user 0:0 \
    --add-host "${LOKI_SVC_DNS}:host-gateway" \
    -v "${SA_TOKEN_HOST_FILE}":"${SA_TOKEN_CONTAINER_FILE}":ro \
    -v "${BRIDGE_CA_BUNDLE}":"${BRIDGE_CA_CONTAINER_FILE}":ro \
    ${SSL_CERT_ENV} \
    --env-file <(set | grep BRIDGE) \
    --env BRIDGE_PLUGIN_PROXY="{\"services\": [{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/perses/\", \"endpoint\":\"http://host.docker.internal:8080\",\"authorize\":true},{\"consoleAPIPath\": \"/api/proxy/plugin/monitoring-console-plugin/loki/\", \"endpoint\":\"${LOKI_HOST}\",\"authorize\":true}]}" \
    $CONSOLE_IMAGE
fi
