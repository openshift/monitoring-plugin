#!/bin/bash
echo "--------------------------------"
echo "MP_IMAGE: ${MP_IMAGE}"
echo "--------------------------------"

oc patch clusterversion version --type json -p "$(cat ./cypress/fixtures/cmo/disable-monitoring.yaml)"

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

#original solution that works locally but in prowJob the container does not have jq installed
# echo "--------------------------------"
# echo "MP_IMAGE: ${MP_IMAGE}"
# echo "--------------------------------"

# oc patch clusterversion version --type json -p "$(cat ./cypress/fixtures/cmo/disable-monitoring.yaml)"

# oc scale --replicas=0 -n openshift-monitoring deployment/cluster-monitoring-operator

# oc scale --replicas=0 -n openshift-monitoring deployment/monitoring-plugin

# oc patch deployment cluster-monitoring-operator -n openshift-monitoring --type json -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/args/'"$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o json | jq '.spec.template.spec.containers[0].args | map(startswith("-images=monitoring-plugin=")) | index(true)')"'", "value": "-images=monitoring-plugin='registry.build05.ci.openshift.org/ci-op-mnc59wsg/pipeline@sha256:71beb9f4a4b36bd6bebfe1a9f822a10dbba696e28690fda52569cd0374afae9c'"}]'

# oc scale --replicas=1 -n openshift-monitoring deployment/cluster-monitoring-operator

# oc scale --replicas=2 -n openshift-monitoring deployment/monitoring-plugin

# sleep 30

# echo "--------------------------------"
# echo "Cluster monitoring operator"
# echo "--------------------------------"
# csv=$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o yaml)
# echo "${csv}"
# echo "--------------------------------"
# echo "Monitoring plugin"
# echo "--------------------------------"
# csv=$(oc get deployment monitoring-plugin -n openshift-monitoring -o yaml)
# echo "${csv}"
# echo "--------------------------------"