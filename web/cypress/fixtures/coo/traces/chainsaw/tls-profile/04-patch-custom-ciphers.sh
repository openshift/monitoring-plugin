#!/bin/bash
set -euo pipefail

# Patch the distributed-tracing deployment with custom cipher suites.
# Uses TLS 1.2 with a restricted set of cipher suites.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

echo "============================================="
echo "Step 4: Patch deployment for Custom cipher suites"
echo "============================================="

# Save baseline pod UID to verify restart
BASELINE_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
echo "Baseline pod UID: $BASELINE_UID"

# Patch with specific cipher suites and TLS 1.2 min version
CIPHER_SUITES="TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
patch_tls_env "VersionTLS12" "$CIPHER_SUITES"

# Verify the pod was restarted (new UID)
NEW_UID=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.uid}')
if [ "$NEW_UID" != "$BASELINE_UID" ]; then
  echo "PASS: Pod restarted (UID changed: $BASELINE_UID -> $NEW_UID)"
else
  fail "Pod was not restarted after TLS env patch"
fi

# Verify env vars are set
MIN_VER=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_MIN_VERSION")].value}')
CIPHER_VAL=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_CIPHER_SUITES")].value}')

if [ "$MIN_VER" != "VersionTLS12" ]; then
  fail "TLS_MIN_VERSION expected VersionTLS12, got: $MIN_VER"
fi
if [ "$CIPHER_VAL" != "$CIPHER_SUITES" ]; then
  fail "TLS_CIPHER_SUITES not set correctly, got: $CIPHER_VAL"
fi

echo "PASS: Deployment patched with custom TLS cipher suites"
echo "  TLS_MIN_VERSION=$MIN_VER"
echo "  TLS_CIPHER_SUITES=$CIPHER_VAL"
