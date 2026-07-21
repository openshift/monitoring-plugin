#!/usr/bin/env bash
set -euo pipefail

echo "Patching ClusterVersion to disable CMO management of monitoring-plugin..."
oc patch clusterversion version --type json \
  -p "$(cat ./web/cypress/fixtures/cmo/disable-monitoring.yaml)"

echo "Scaling down cluster-monitoring-operator in openshift-monitoring..."
kubectl scale --replicas=0 -n openshift-monitoring deployment/cluster-monitoring-operator
