#!/bin/bash

# Generate a random filename
RANDOM_FILE="/tmp/lightspeed_console_csv_$(date +%s%N).yaml"

LIGHTSPEED_CSV_NAME=$(oc get csv --kubeconfig "${KUBECONFIG}" --namespace="${LIGHTSPEED_NAMESPACE}" | grep "lightspeed-operator" | awk '{print $1}')

oc get csv "${LIGHTSPEED_CSV_NAME}" -n "${LIGHTSPEED_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the CSV file deployment args for console-image
sed -i "s#--console-image=.*#--console-image=${LIGHTSPEED_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file deployment args for console-image-pf5
sed -i "s#--console-image-pf5=.*#--console-image-pf5=${LIGHTSPEED_CONSOLE_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file related images for lightspeed-console-plugin
sed -i "/name: lightspeed-console-plugin$/!b;n;s#image: .*#image: ${LIGHTSPEED_CONSOLE_IMAGE}#" "${RANDOM_FILE}"

# Patch the CSV file related images for lightspeed-console-plugin-pf5
sed -i "/name: lightspeed-console-plugin-pf5$/!b;n;s#image: .*#image: ${LIGHTSPEED_CONSOLE_IMAGE}#" "${RANDOM_FILE}"

# Apply the patched CSV resource file
oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 10
oc wait --for=condition=Ready pods --selector=control-plane=controller-manager -n "${LIGHTSPEED_NAMESPACE}" --timeout=180s --kubeconfig "${KUBECONFIG}"
