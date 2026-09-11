#!/bin/bash

# Script to patch the cluster-health-analyzer image in COO CSV
# Used by Cypress tests to test custom CHA builds

echo "--------------------------------"
echo "CHA_IMAGE: ${CHA_IMAGE}"
echo "--------------------------------"

# Generate a random filename
RANDOM_FILE="/tmp/coo_cha_csv_$(date +%s%N).yaml"

COO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${MCP_NAMESPACE}" | grep "cluster-observability-operator" | awk '{print $1}')

if [ -z "${COO_CSV_NAME}" ]; then
    echo "Error: Could not find cluster-observability-operator CSV in namespace ${MCP_NAMESPACE}"
    exit 1
fi

echo "Found COO CSV: ${COO_CSV_NAME}"

oc get csv "${COO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the CSV file env vars for cluster-health-analyzer
# Handle both US and UK spellings (analyser/analyzer) for compatibility
sed -i "s#value: .*cluster-health-analy[sz]er.*#value: ${CHA_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file related images
sed -i "s#^\([[:space:]]*- image:\).*cluster-health-analy[sz]er.*#\1 ${CHA_IMAGE}#g" "${RANDOM_FILE}"

# Apply the patched CSV resource file
oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Wait for the operator to reconcile the change
sleep 25

# Wait for health-analyzer pod to be ready with the new image
OUTPUT=$(oc wait --for=condition=ready pods -l app.kubernetes.io/instance=health-analyzer -n "${MCP_NAMESPACE}" --timeout=120s --kubeconfig "${KUBECONFIG}")
echo "${OUTPUT}"

echo "--------------------------------"
echo "Health-analyzer pod status:"
echo "--------------------------------"
oc get pods -l app.kubernetes.io/instance=health-analyzer -n "${MCP_NAMESPACE}" -o wide --kubeconfig "${KUBECONFIG}"
echo "--------------------------------"

