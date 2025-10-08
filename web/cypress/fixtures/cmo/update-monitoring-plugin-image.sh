#!/bin/bash
oc patch clusterversion version --type json -p "$(cat disable-monitoring.yaml)"

oc scale --replicas=0 -n openshift-monitoring deployment/cluster-monitoring-operator

oc scale --replicas=0 -n openshift-monitoring deployment/monitoring-plugin

oc patch deployment cluster-monitoring-operator -n openshift-monitoring --type json -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/args/'"$(oc get deployment cluster-monitoring-operator -n openshift-monitoring -o json | jq '.spec.template.spec.containers[0].args | map(startswith("-images=monitoring-plugin=")) | index(true)')"'", "value": "-images=monitoring-plugin='"${MP_IMAGE}"'"}]'

oc scale --replicas=1 -n openshift-monitoring deployment/cluster-monitoring-operator

oc scale --replicas=2 -n openshift-monitoring deployment/monitoring-plugin

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

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 30
OUTPUT=`oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n openshift-monitoring --timeout=60s`
echo "${OUTPUT}"