#!/usr/bin/env bash
#
# Run the plugin backend locally with the tracing feature, in a container, so
# its Tempo proxy can reach the cluster's Tempo gateways.
#
# The backend proxies trace queries to
# https://tempo-<name>-gateway.<ns>.svc:8080 (pkg/tracing/proxy/proxy.go). A
# backend on the host cannot resolve service names, so this script runs
# `go run ./cmd/plugin-backend.go` in a Go container, maps each gateway's
# service DNS name to a local `oc port-forward` with --add-host, and trusts the
# cluster's service CA. It replaces `make start-coo-backend` for tracing
# sessions: same PLUGIN_PORT, plain HTTP, serves web/dist and config/.
#
# Usage:
#   TEMPO_INSTANCES=<ns>/<name>[,<ns>/<name>...] ./scripts/start-tracing-backend.sh
#   TEMPO_INSTANCES=<ns>/<name>[,<ns>/<name>...] make start-tracing-backend
#
# TEMPO_INSTANCES lists multi-tenant TempoStack or TempoMonolithic instances;
# single-tenant instances are hidden by the plugin and never proxied. The
# script prints the port-forward commands to run in separate terminals.
#
# Optional:
#   TRACING_DEV_FEATURES   backend -features (default: tracing)
#   PLUGIN_PORT            backend port (default: 9443, as in start-console.sh)
#   KUBECONFIG             a single kubeconfig file (default: $HOME/.kube/config);
#                          the backend lists Tempo CRs with this identity
#   TRACING_BACKEND_IMAGE  Go image (default: the go-toolset image of Dockerfile.mcp)
#   DRY_RUN=1              print the container command instead of running it

set -euo pipefail

TEMPO_INSTANCES=${TEMPO_INSTANCES:-}
TRACING_DEV_FEATURES=${TRACING_DEV_FEATURES:-tracing}
PLUGIN_PORT=${PLUGIN_PORT:-9443}
KUBECONFIG=${KUBECONFIG:-"${HOME}/.kube/config"}
TRACING_BACKEND_IMAGE=${TRACING_BACKEND_IMAGE:-"registry.access.redhat.com/ubi9/go-toolset:1.26"}
DRY_RUN=${DRY_RUN:-}

usage() {
    echo "Error: $1" >&2
    echo "Usage: TEMPO_INSTANCES=<ns>/<name>[,<ns>/<name>...] $0" >&2
    echo "Example: TEMPO_INSTANCES=tracing-system/simplest,tempo-mono/sample $0" >&2
    exit 1
}

[ -n "${TEMPO_INSTANCES}" ] || usage "TEMPO_INSTANCES is not set"
# A single file, not a colon-separated list: it is mounted into the container.
# Certificate files referenced by path inside it are not mounted.
[ -f "${KUBECONFIG}" ] || usage "KUBECONFIG must be a single existing file, got '${KUBECONFIG}'"

# Prefer podman if installed. Otherwise, fall back to docker.
if [ -x "$(command -v podman)" ]; then
    runtime=podman
elif [ -x "$(command -v docker)" ]; then
    runtime=docker
else
    echo "Error: neither podman nor docker is installed" >&2
    exit 1
fi
# Use host networking with podman on Linux, as start-console.sh does; each
# gateway then gets its own loopback address, so several instances can share
# port 8080 next to the Loki/Perses port-forwards on 127.0.0.1. Elsewhere the
# names resolve to the host gateway, which offers a single port 8080, and the
# port-forward must listen on all interfaces to be reachable from the
# container (Docker on Linux in particular).
if [ "${runtime}" = "podman" ] && [ "$(uname -s)" = "Linux" ]; then
    host_network=true
else
    host_network=false
fi

IFS=',' read -r -a tempo_instances <<< "${TEMPO_INSTANCES}"
if [ "${host_network}" = "false" ] && [ "${#tempo_instances[@]}" -gt 1 ]; then
    usage "only one Tempo instance is supported without host networking (podman on Linux)"
fi

first_namespace=""
add_host_args=()
port_forward_cmds=()
for i in "${!tempo_instances[@]}"; do
    instance=${tempo_instances[$i]}
    # Namespace: DNS-1123 label. Name: DNS-1123 subdomain, like any CR name.
    if ! [[ "${instance}" =~ ^([a-z0-9]([-a-z0-9]*[a-z0-9])?)/([a-z0-9]([-a-z0-9.]*[a-z0-9])?)$ ]]; then
        usage "malformed TEMPO_INSTANCES entry '${instance}', expected <ns>/<name>"
    fi
    namespace=${BASH_REMATCH[1]}
    name=${BASH_REMATCH[3]}
    first_namespace=${first_namespace:-${namespace}}
    # Same rule as monitoring.DNSName, which the Tempo proxy applies to the
    # service name: characters other than [a-z0-9-] become '-'.
    service=$(printf 'tempo-%s-gateway' "${name}" | sed 's/[^a-z0-9-]/-/g')
    if [ "${host_network}" = "true" ]; then
        address="127.0.0.$((i + 2))"
        add_host_args+=(--add-host "${service}.${namespace}.svc:${address}")
    else
        address="0.0.0.0"
        add_host_args+=(--add-host "${service}.${namespace}.svc:host-gateway")
    fi
    port_forward_cmds+=("oc -n ${namespace} port-forward --address ${address} svc/${service} 8080:8080")
done

# The Tempo gateways serve HTTPS with a service-CA certificate. Go's
# SSL_CERT_FILE replaces the whole trust store, so keep the image's system
# bundle next to the service CA (the API server may need it).
TRACING_CA_BUNDLE="$(pwd)/.tracing-ca-bundle.crt"
TRACING_CA_CONTAINER_FILE="/tmp/tracing-ca-bundle.crt"
service_ca=$(oc --kubeconfig "${KUBECONFIG}" -n "${first_namespace}" get configmap openshift-service-ca.crt \
    -o jsonpath='{.data.service-ca\.crt}' 2>/dev/null) || service_ca=""
if [ -n "${service_ca}" ]; then
    "${runtime}" run --rm --entrypoint cat "${TRACING_BACKEND_IMAGE}" \
        /etc/pki/tls/certs/ca-bundle.crt > "${TRACING_CA_BUNDLE}" 2>/dev/null ||
        { echo "Warning: cannot read the system CA bundle from ${TRACING_BACKEND_IMAGE}"; : > "${TRACING_CA_BUNDLE}"; }
    printf '%s\n' "${service_ca}" >> "${TRACING_CA_BUNDLE}"
else
    : > "${TRACING_CA_BUNDLE}"
    echo "Warning: no service CA found in ${first_namespace}; the Tempo proxy will fail TLS verification"
fi

# Point SSL_CERT_FILE at the bundle only when it has content: an empty file
# would blank the backend's whole TLS trust store.
ssl_cert_args=()
if [ -s "${TRACING_CA_BUNDLE}" ]; then
    ssl_cert_args=(--env "SSL_CERT_FILE=${TRACING_CA_CONTAINER_FILE}")
fi

if [ "${host_network}" = "true" ]; then
    network_args=(--network=host)
else
    network_args=(-p "${PLUGIN_PORT}:${PLUGIN_PORT}")
fi

# The go-toolset image runs as UID 1001, which cannot write the cache volumes
# or read a 600 kubeconfig, so run as root; under rootless podman container
# root maps to the invoking user. label=disable avoids relabeling the mounted
# repository for SELinux.
run_cmd=(
    "${runtime}" run --rm --name monitoring-plugin-tracing-backend
    "${network_args[@]}" --user 0:0 --security-opt label=disable
    "${add_host_args[@]}"
    -v "$(pwd)":/workspace:ro -w /workspace
    -v monitoring-plugin-go-mod-cache:/var/cache/go/mod
    -v monitoring-plugin-go-build-cache:/var/cache/go/build
    --env GOMODCACHE=/var/cache/go/mod --env GOCACHE=/var/cache/go/build
    --env GOFLAGS=-buildvcs=false
    -v "${KUBECONFIG}":/tmp/kubeconfig:ro --env KUBECONFIG=/tmp/kubeconfig
    -v "${TRACING_CA_BUNDLE}":"${TRACING_CA_CONTAINER_FILE}":ro
    ${ssl_cert_args[@]+"${ssl_cert_args[@]}"}
    "${TRACING_BACKEND_IMAGE}"
    go run ./cmd/plugin-backend.go -port="${PLUGIN_PORT}" -config-path=./config
    -plugin-config-path=./hack/default-config.yaml -static-path=./web/dist
    -features="${TRACING_DEV_FEATURES}"
)

echo "Starting local tracing backend..."
echo "Backend URL: http://localhost:${PLUGIN_PORT}"
echo "Features: ${TRACING_DEV_FEATURES}"
echo "Kubeconfig: ${KUBECONFIG}"
echo "Image: ${TRACING_BACKEND_IMAGE}"
echo "Run in separate terminals, logged in to the cluster:"
for cmd in "${port_forward_cmds[@]}"; do
    echo "  ${cmd}"
done

if [ -n "${DRY_RUN}" ]; then
    printf '%q ' "${run_cmd[@]}"
    echo
    exit 0
fi
exec "${run_cmd[@]}"
