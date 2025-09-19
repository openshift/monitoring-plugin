#!/bin/bash

oc patch clusterversion version --type json -p '[{"op":"remove", "path":"/spec/overrides"}]'
oc delete replicaset --selector=app=cluster-monitoring-operator -n openshift-monitoring
oc scale --replicas=1 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator
oc scale --replicas=2 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 30
oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n "${MP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"
oc wait --for=condition=ready pods -l app.kubernetes.io/name=cluster-monitoring-operator -n "${MP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"