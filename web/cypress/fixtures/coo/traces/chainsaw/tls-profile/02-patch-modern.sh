#!/bin/bash
set -euo pipefail

# Patch the distributed-tracing deployment to use the Modern TLS profile (TLS 1.3 only).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

echo "============================================="
echo "Step 2: Patch deployment for Modern TLS profile"
echo "============================================="

# Save baseline pod UID to verify restart
BASELINE_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
echo "Baseline pod UID: $BASELINE_UID"

# Patch with TLS_MIN_VERSION=VersionTLS13
patch_tls_env "VersionTLS13" ""

# Verify the pod was restarted (new UID)
NEW_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
if [ "$NEW_UID" != "$BASELINE_UID" ]; then
  echo "PASS: Pod restarted (UID changed: $BASELINE_UID -> $NEW_UID)"
else
  fail "Pod was not restarted after TLS env patch"
fi

# Verify the env var is set
ENV_VALUE=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_MIN_VERSION")].value}')
if [ "$ENV_VALUE" != "VersionTLS13" ]; then
  fail "TLS_MIN_VERSION env var not set correctly, got: $ENV_VALUE"
fi

echo "PASS: Deployment patched with TLS_MIN_VERSION=VersionTLS13"
