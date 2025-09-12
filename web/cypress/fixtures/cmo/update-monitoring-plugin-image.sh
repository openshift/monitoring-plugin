#!/bin/bash

# Generate a random filename
MONITORING_FILE="/tmp/monitoring_csv_$(date +%s%N).yaml"

MONITORING_CSV_NAME=$(oc get deployment --kubeconfig "${KUBECONFIG}" --namespace="${MP_NAMESPACE}" | grep "monitoring-plugin" | awk '{print $1}')

oc project --namespace="${MP_NAMESPACE}"

oc get deployment "${MONITORING_CSV_NAME}" -n "${MP_NAMESPACE}" -o yaml > "${MONITORING_FILE}" --kubeconfig "${KUBECONFIG}"

# Patch the deployment file related images
sed -i "s#^\([[:space:]]*image: \).*#\1${MP_IMAGE}#g" "${MONITORING_FILE}"

oc replace -f "${MONITORING_FILE}" --kubeconfig "${KUBECONFIG}"

# Scale down the cluster-monitoring-operator as "manager" pod is responsible for the monitoring-plugin
oc patch clusterversion version --type json -p "$(cat disable-monitoring.yaml)"

oc scale --replicas=0 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator

# Apply the patched deployment resource file
oc replace -f "${MONITORING_FILE}" --kubeconfig "${KUBECONFIG}"

# Scale up the monitoring-plugin with new image, leaving the cluster-monitoring-operator at 0 replicas to not revert the change
oc scale --replicas=1 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 30
OUTPUT=`oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n "${MP_NAMESPACE}" --timeout=60s`
echo "${OUTPUT}"