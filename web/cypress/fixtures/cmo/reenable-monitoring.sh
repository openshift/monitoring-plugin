#!/bin/bash
oc patch clusterversion version --type json -p '[{"op":"remove", "path":"/spec/overrides"}]'
oc scale --replicas=0 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator
oc scale --replicas=0 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

oc scale --replicas=1 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator
oc scale --replicas=2 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

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