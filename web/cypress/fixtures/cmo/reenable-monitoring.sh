#!/bin/bash

oc patch clusterversion version --type json -p "$(cat enable-monitoring.yaml)"
kubectl scale --replicas=2 -n "${MP_NAMESPACE}" deployment/cluster-monitoring-operator
kubectl scale --replicas=2 -n "${MP_NAMESPACE}" deployment/monitoring-plugin

# Wait for the operator to reconcile the change and make sure all the pods are running.
sleep 5
oc wait --for=condition=Ready pods --selector=app.kubernetes.io/part-of=monitoring-plugin -n "${MP_NAMESPACE}" --timeout=60s
oc wait --for=condition=ready pods -l app.kubernetes.io/name=cluster-monitoring-operator -n "${MP_NAMESPACE}" --timeout=60s --kubeconfig "${KUBECONFIG}"