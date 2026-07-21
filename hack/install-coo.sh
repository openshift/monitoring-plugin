#!/usr/bin/env bash
set -euo pipefail

echo "Checking if COO is already installed..."
if kubectl get deployment -n openshift-cluster-observability-operator observability-operator \
    >/dev/null 2>&1; then
    echo "COO is already installed, skipping."
    exit 0
fi

echo "Creating namespace openshift-cluster-observability-operator..."
kubectl create namespace openshift-cluster-observability-operator --dry-run=client -o yaml | kubectl apply -f -

echo "Creating OperatorGroup..."
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: observability-operator-group
  namespace: openshift-cluster-observability-operator
spec: {}
EOF

echo "Creating Subscription..."
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: cluster-observability-operator
  namespace: openshift-cluster-observability-operator
spec:
  channel: fast
  name: cluster-observability-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF

echo "Waiting for COO CSV to reach Succeeded phase (timeout 5m)..."
SECONDS_ELAPSED=0
until kubectl get csv -n openshift-cluster-observability-operator \
    -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "^Succeeded$"; do
    if [[ ${SECONDS_ELAPSED} -ge 300 ]]; then
        echo "ERROR: Timed out waiting for COO CSV to succeed."
        exit 1
    fi
    sleep 5
    SECONDS_ELAPSED=$((SECONDS_ELAPSED + 5))
    echo "  Waiting... (${SECONDS_ELAPSED}s / 300s)"
done

echo "COO installed successfully."
