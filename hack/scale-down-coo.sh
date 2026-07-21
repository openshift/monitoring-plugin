#!/usr/bin/env bash
set -euo pipefail

echo "Scaling down observability-operator..."
kubectl scale --replicas=0 -n openshift-cluster-observability-operator deployment/observability-operator

echo "Waiting for observability-operator to scale down..."
kubectl rollout status deployment/observability-operator \
  -n openshift-cluster-observability-operator \
  --timeout=120s

echo "Re-enabling monitoring-console-plugin in Console..."
# COO removes the plugin from the Console when scaled down — add it back so the
# devspace container is reachable from the Console frontend.
PLUGINS=$(oc get console.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null)
if [[ -z "${PLUGINS}" ]]; then
  oc patch console.operator.openshift.io cluster --type=json \
    -p '[{"op":"add","path":"/spec/plugins","value":["monitoring-console-plugin"]}]'
elif ! echo "${PLUGINS}" | grep -q "monitoring-console-plugin"; then
  oc patch console.operator.openshift.io cluster --type=json \
    -p '[{"op":"add","path":"/spec/plugins/-","value":"monitoring-console-plugin"}]'
else
  echo "monitoring-console-plugin already enabled in Console, skipping."
fi
