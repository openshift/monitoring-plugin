#!/bin/bash
echo "--------------------------------"
echo "MCP_CONSOLE_IMAGE: ${MCP_CONSOLE_IMAGE}"
echo "--------------------------------"

# Generate a random filename
RANDOM_FILE="/tmp/coo_monitoring_csv_$(date +%s%N).yaml"

COO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${MCP_NAMESPACE}" | grep "cluster-observability-operator" | awk '{print $1}' | sort -V | tail -1)
 echo "COO_CSV_NAME: ${COO_CSV_NAME}"
if [ -z "${COO_CSV_NAME}" ]; then
  echo "ERROR: could not find cluster-observability-operator CSV in namespace ${MCP_NAMESPACE}"
  exit 1
fi

patch_csv() {
  oc get csv "${COO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

  # Patch the CSV file env vars
  sed -i "s#value: .*monitoring-console-plugin.*#value: ${MCP_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

  # Patch the CSV file related images
  sed -i "s#^\([[:space:]]*- image:\).*monitoring-console-plugin.*#\1 ${MCP_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

  echo "--------------------------------"
  echo "COO CSV content after patching (local file)"
  echo "--------------------------------"
  cat "${RANDOM_FILE}"
  echo "--------------------------------"

  oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"
}

# Initial patch
patch_csv

# Verify the CSV patch was applied and not reverted by OLM.
# OLM may reconcile the CSV and revert the image back to the original.
MAX_CSV_RETRIES=6
CSV_RETRY_INTERVAL=10
CSV_PATCHED=false

for i in $(seq 1 $MAX_CSV_RETRIES); do
  sleep $CSV_RETRY_INTERVAL

  LIVE_CSV=$(oc get csv "${COO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml --kubeconfig "${KUBECONFIG}")

  if echo "${LIVE_CSV}" | grep -qF "${MCP_CONSOLE_IMAGE}"; then
    echo "CSV patch verified successfully on attempt ${i}"
    CSV_PATCHED=true
    break
  fi

  echo "CSV patch was reverted by OLM (attempt ${i}/${MAX_CSV_RETRIES}). Re-applying..."
  patch_csv
done

if [ "${CSV_PATCHED}" = false ]; then
  echo "WARNING: CSV patch could not be stabilized after ${MAX_CSV_RETRIES} attempts"
fi

echo "--------------------------------"
echo "COO CSV live content after verification loop"
echo "--------------------------------"
oc get csv "${COO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml --kubeconfig "${KUBECONFIG}"
echo "--------------------------------"

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 25
OUTPUT=$(oc wait --for=condition=ready pods -l app.kubernetes.io/name=observability-operator -n "${MCP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}")
rc=$?
echo "${OUTPUT}"
if [ $rc -ne 0 ]; then
  echo "ERROR: oc wait failed with exit code ${rc}"
  exit $rc
fi
