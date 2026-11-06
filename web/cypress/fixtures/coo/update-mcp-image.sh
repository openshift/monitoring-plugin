#!/bin/bash
echo "--------------------------------"
echo "MCP_CONSOLE_IMAGE: ${MCP_CONSOLE_IMAGE}"
echo "--------------------------------"

# Generate a random filename
RANDOM_FILE="/tmp/coo_monitoring_csv_$(date +%s%N).yaml"

# Detect which operator is installed in the namespace.
# cluster-observability-operator uses a CSV that embeds the console-plugin image
# as an env var and relatedImage — patch by value replacement.
# observability-operator (standalone) does not embed the image; it must be passed
# as --images=ui-monitoring=<image> in the operator container args.
COO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${MCP_NAMESPACE}" \
  --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null \
  | grep 'cluster-observability-operator' | sort -V | tail -1)

OO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${MCP_NAMESPACE}" \
  --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null \
  | grep 'observability-operator' | grep -v 'cluster-observability-operator' \
  | sort -V | tail -1)

if [ -n "${COO_CSV_NAME}" ]; then
  echo "Detected cluster-observability-operator CSV: ${COO_CSV_NAME}"
  OPERATOR_MODE="coo"
elif [ -n "${OO_CSV_NAME}" ]; then
  echo "Detected observability-operator CSV: ${OO_CSV_NAME}"
  OPERATOR_MODE="oo"
else
  echo "ERROR: could not find cluster-observability-operator or observability-operator CSV in namespace ${MCP_NAMESPACE}"
  exit 1
fi

# ── cluster-observability-operator: replace image values in YAML ──────────────

patch_csv_coo() {
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

# ── observability-operator: inject --images=ui-monitoring=<image> as an arg ──

patch_csv_oo() {
  oc get csv "${OO_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml \
    --kubeconfig "${KUBECONFIG}" > "${RANDOM_FILE}"

  if grep -qF -- '--images=ui-monitoring=' "${RANDOM_FILE}"; then
    # Arg already present — replace the existing value in-place
    sed -i "s#- --images=ui-monitoring=.*#- --images=ui-monitoring=${MCP_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"
  else
    # Arg absent — insert after --namespace=$(NAMESPACE) and any existing -- args,
    # before the env: block. Uses the same anchor as observability-operator-bundle-quay.sh.
    # Captures indentation dynamically so it works regardless of YAML nesting depth.
    IMAGE="${MCP_CONSOLE_IMAGE}" perl -0777 -i -pe \
      's|(( *)- --namespace=\$\(NAMESPACE\)\n(?:\2- --[^\n]+\n)*)(\2env:)|$1$2- --images=ui-monitoring=$ENV{IMAGE}\n$3|s' \
      "${RANDOM_FILE}"
    if ! grep -qF -- '--images=ui-monitoring=' "${RANDOM_FILE}"; then
      echo "ERROR: could not insert --images=ui-monitoring= (anchor --namespace=\$(NAMESPACE) not found before env: in CSV)"
      exit 1
    fi
  fi

  echo "--------------------------------"
  echo "OO CSV args after patching (local file)"
  echo "--------------------------------"
  grep -A 10 '- --namespace=' "${RANDOM_FILE}" | head -15 || true
  echo "--------------------------------"

  oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"
}

# Dispatch to the right patch function and resolve CSV name for the verify loop
if [ "${OPERATOR_MODE}" = "coo" ]; then
  ACTIVE_CSV_NAME="${COO_CSV_NAME}"
  patch_csv() { patch_csv_coo; }
else
  ACTIVE_CSV_NAME="${OO_CSV_NAME}"
  patch_csv() { patch_csv_oo; }
fi

# Initial patch
patch_csv

# Verify the CSV patch was applied and not reverted by OLM.
# OLM may reconcile the CSV and revert the change back to the original.
MAX_CSV_RETRIES=6
CSV_RETRY_INTERVAL=10
CSV_PATCHED=false

for i in $(seq 1 $MAX_CSV_RETRIES); do
  sleep $CSV_RETRY_INTERVAL

  LIVE_CSV=$(oc get csv "${ACTIVE_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml --kubeconfig "${KUBECONFIG}")

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
echo "CSV live content after verification loop"
echo "--------------------------------"
oc get csv "${ACTIVE_CSV_NAME}" -n "${MCP_NAMESPACE}" -o yaml --kubeconfig "${KUBECONFIG}"
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
