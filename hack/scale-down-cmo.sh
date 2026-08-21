#!/usr/bin/env bash
set -euo pipefail

echo "Patching ClusterVersion to disable CMO management of monitoring-plugin..."
oc patch clusterversion version --type json \
    -p "$(cat ./web/cypress/fixtures/cmo/disable-monitoring.yaml)"

echo "Scaling down cluster-monitoring-operator in openshift-monitoring..."
kubectl scale --replicas=0 -n openshift-monitoring deployment/cluster-monitoring-operator

echo "Waiting for cluster-monitoring-operator to scale down..."
kubectl rollout status deployment/cluster-monitoring-operator \
    -n openshift-monitoring \
    --timeout=120s
