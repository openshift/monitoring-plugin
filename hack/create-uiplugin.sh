#!/usr/bin/env bash
set -euo pipefail

echo "Applying UIPlugin CR 'monitoring'..."
kubectl apply -f - <<EOF
apiVersion: observability.openshift.io/v1alpha1
kind: UIPlugin
metadata:
  name: monitoring
  namespace: openshift-cluster-observability-operator
spec:
  type: Monitoring
  monitoring:
    perses:
      enabled: true
    clusterHealthAnalyzer:
      enabled: true
    acm:
      enabled: true
      alertmanager:
        url: "https://alertmanager.open-cluster-management-observability.svc:9095"
      thanosQuerier:
        url: "https://rbac-query-proxy.open-cluster-management-observability.svc:8443"
EOF

echo "Waiting for monitoring deployment to become available..."
kubectl rollout status deployment/monitoring \
    -n openshift-cluster-observability-operator \
    --timeout=300s
