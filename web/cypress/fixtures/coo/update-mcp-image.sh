#!/bin/bash

# Generate a random filename
RANDOM_FILE="/tmp/coo_monitoring_csv_$(date +%s%N).yaml"

COO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${MCP_NAMESPACE}" | grep "cluster-observability-operator" | awk '{print $1}')

oc get csv "${COO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the CSV file env vars
sed -i "s#value: .*monitoring-console-plugin.*#value: ${MCP_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file related images
sed -i "s#^\([[:space:]]*- image:\).*monitoring-console-plugin.*#\1 ${MCP_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Apply the patched CSV resource file
oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 25
OUTPUT=`oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=observability-operator -n "${MCP_NAMESPACE}" --timeout=60s`
echo "${OUTPUT}"
OUTPUT=`oc wait --for=condition=ready pods -l app.kubernetes.io/name=observability-operator -n "${MCP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"`
echo "${OUTPUT}"