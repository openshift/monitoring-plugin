#!/bin/bash
set -euo pipefail

# Revert the distributed-tracing deployment to the default TLS configuration
# by removing all TLS environment variables. Verify Intermediate profile is restored.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

detect_fips

echo "============================================="
echo "Step 8: Revert to default and verify Intermediate"
echo "============================================="

# Save baseline pod UID
BASELINE_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
echo "Baseline pod UID: $BASELINE_UID"

# Remove TLS env vars
remove_tls_env

# Verify the pod was restarted
NEW_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
if [ "$NEW_UID" != "$BASELINE_UID" ]; then
  echo "PASS: Pod restarted (UID changed: $BASELINE_UID -> $NEW_UID)"
else
  echo "NOTE: Pod UID unchanged - deployment may not have changed"
fi

# Verify no TLS env vars remain
CONTAINER_ENV=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env}' 2>/dev/null || echo "null")
if [ "$CONTAINER_ENV" != "" ] && [ "$CONTAINER_ENV" != "null" ]; then
  if echo "$CONTAINER_ENV" | grep -q "TLS_MIN_VERSION\|TLS_CIPHER_SUITES"; then
    fail "TLS env vars still present after revert"
  fi
fi
echo "PASS: TLS env vars removed"

# Verify Intermediate profile is restored
verify_nmap_tls_profile "intermediate" "Reverted to Intermediate profile"

# Verify endpoints
verify_all_endpoints "Reverted Intermediate profile"

# Scale the operator back up so it resumes managing the deployment
scale_up_operator

# Give the operator a moment to reconcile, then verify the deployment is still healthy
sleep 10
kubectl wait --for=condition=Ready pods -l "$LABEL_SELECTOR" -n "$NAMESPACE" --timeout=120s

echo ""
echo "============================================="
echo "PASS: Successfully reverted to default Intermediate profile"
echo "  - TLS env vars removed"
echo "  - TLS 1.2 and TLS 1.3 both supported"
echo "  - All endpoints responding correctly"
echo "  - Observability operator scaled back up"
echo "============================================="
