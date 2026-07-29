#!/usr/bin/env bash
set -euo pipefail

echo "Scaling up observability-operator..."
kubectl scale --replicas=1 -n openshift-cluster-observability-operator deployment/observability-operator
