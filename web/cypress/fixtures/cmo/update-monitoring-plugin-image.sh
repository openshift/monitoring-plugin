#!/bin/bash
MONITORING_FILE="/tmp/monitoring_csv_$(date +%s%N).yaml"
MONITORING_CSV_NAME=$(oc get deployment --kubeconfig "${KUBECONFIG}" -n openshift-monitoring | grep "monitoring-plugin" | awk '{print $1}')

oc get deployment "${MONITORING_CSV_NAME}" -n openshift-monitoring -o yaml > "${MONITORING_FILE}" --kubeconfig "${KUBECONFIG}"

sed -i "s#^\([[:space:]]*image: \).*#\1${MP_IMAGE}#g" "${MONITORING_FILE}"

oc patch deployment cluster-monitoring-operator -n openshift-monitoring --type json -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/args/'"$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o json | jq '.spec.template.spec.containers[0].args | map(startswith("-images=monitoring-plugin=")) | index(true)')"'", "value": "-images=monitoring-plugin='"${MP_IMAGE}"'"}]'

oc replace -f "${MONITORING_FILE}" --kubeconfig "${KUBECONFIG}"

oc patch clusterversion version --type json --patch-file ./cypress/fixtures/cmo/disable-monitoring.yaml

oc delete replicaset --selector=app=cluster-monitoring-operator -n openshift-monitoring

echo "--------------------------------"
echo "Monitoring file"
echo "--------------------------------"
echo "$(cat ${MONITORING_FILE})"
echo "--------------------------------"
echo "Cluster monitoring operator"
echo "--------------------------------"
csv=$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o yaml)
echo "${csv}"
echo "--------------------------------"

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 30
OUTPUT=`oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n openshift-monitoring --timeout=60s`
echo "${OUTPUT}"