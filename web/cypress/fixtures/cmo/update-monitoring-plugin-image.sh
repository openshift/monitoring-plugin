#!/bin/bash

# Generate a random filename
RANDOM_FILE="/tmp/cmo_monitoring_csv_$(date +%s%N).yaml"

CMO_CSV_NAME=$(oc get deployment --kubeconfig "${KUBECONFIG}" --namespace="${MP_NAMESPACE}" | grep "cluster-monitoring-operator" | awk '{print $1}')

oc project --namespace="${MP_NAMESPACE}"

oc get deployment "${CMO_CSV_NAME}" -n "${MP_NAMESPACE}" -o yaml > "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the CSV file env vars
sed -i "s#value: .*monitoring-plugin.*#value: ${MP_IMAGE}#g" "${RANDOM_FILE}"

# Patch the CSV file related images
sed -i "s#^\([[:space:]]*- image:\).*monitoring-plugin.*#\1 ${MP_IMAGE}#g" "${RANDOM_FILE}"

# Scale down
oc patch clusterversion version --type json -p "$(cat disable-monitoring.yaml)"

oc scale --replicas=0 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator

oc scale --replicas=0 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

# Apply the patched CSV resource file
oc replace -f "${RANDOM_FILE}" --kubeconfig "${KUBECONFIG}"

# Scale up the Monitoring-plugin
oc scale --replicas=1 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator

oc scale --replicas=1 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 25
OUTPUT=`oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n "${MP_NAMESPACE}" --timeout=60s`
echo "${OUTPUT}"
OUTPUT=`oc wait --for=condition=ready pods -l app.kubernetes.io/name=cluster-monitoring-operator -n "${MP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"`
echo "${OUTPUT}"