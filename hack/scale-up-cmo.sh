#!/usr/bin/env bash
set -euo pipefail

echo "Restoring ClusterVersion to re-enable CMO management of monitoring-plugin..."
oc patch clusterversion version --type json \
  -p '[{"op": "remove", "path": "/spec/overrides"}]'

echo "Scaling up cluster-monitoring-operator in openshift-monitoring..."
kubectl scale --replicas=1 -n openshift-monitoring deployment/cluster-monitoring-operator
