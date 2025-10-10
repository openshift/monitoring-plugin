#!/bin/bash
echo "--------------------------------"
echo "MP_IMAGE: ${MP_IMAGE}"
echo "--------------------------------"

CMO_FILE="/tmp/cmo_monitoring_csv_$(date +%s%N).yaml"

oc get deployment cluster-monitoring-operator -n openshift-monitoring -o yaml > "${CMO_FILE}" --kubeconfig "${KUBECONFIG}"

sed -i "s#value: .*monitoring-plugin.*#value: ${MP_IMAGE}#g" "${CMO_FILE}"
sed -i "s#^\([[:space:]]*- -images=monitoring-plugin=\).*#\1${MP_IMAGE}#g" "${CMO_FILE}"

oc patch clusterversion version --type json -p "$(cat ./cypress/fixtures/cmo/disable-monitoring.yaml)"

oc replace -f "${CMO_FILE}" --kubeconfig "${KUBECONFIG}"

sleep 30

echo "--------------------------------"
echo "Cluster monitoring operator"
echo "--------------------------------"
csv=$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o yaml)
echo "${csv}"
echo "--------------------------------"
echo "Monitoring plugin"
echo "--------------------------------"
csv=$(oc get deployment monitoring-plugin -n openshift-monitoring -o yaml)
echo "${csv}"
echo "--------------------------------"
