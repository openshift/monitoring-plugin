#!/bin/bash

# Generate a random filename
RANDOM_FILE="/tmp/coo_tracing_csv_$(date +%s%N).yaml"

COO_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${DTP_NAMESPACE}" | grep "cluster-observability-operator" | awk '{print $1}')

oc get csv "${COO_CSV_NAME}" -n "${DTP_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the CSV file env vars
sed -i "s#value: .*monitoring-plugin.*#value: ${DT_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file related images
sed -i "s#^\([[:space:]]*- image:\).*monitoring-plugin.*#\1 ${DT_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Apply the patched CSV resource file
oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 5
oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=observability-operator -n "${DTP_NAMESPACE}" --timeout=60s
oc wait --for=condition=ready pods -l app.kubernetes.io/name=observability-operator -n "${DTP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"