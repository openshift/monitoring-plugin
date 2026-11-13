#!/bin/bash
set -euo pipefail

# Verify Old TLS profile: TLS 1.0+ configured.
# Note: Go 1.22+ dropped TLS 1.0 and 1.1 support, so even with VersionTLS10 configured,
# the effective minimum is TLS 1.2. This test verifies:
# - The configuration is accepted without errors
# - TLS 1.2 and TLS 1.3 are both available
# - Endpoints are functional

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

detect_fips

echo "============================================="
echo "Step 7: Verify Old TLS profile"
echo "============================================="

# --- 1. Verify TLS_MIN_VERSION env var is set ---
echo "=== Checking TLS_MIN_VERSION env var ==="
ENV_VALUE=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_MIN_VERSION")].value}')
if [ "$ENV_VALUE" != "VersionTLS10" ]; then
  fail "TLS_MIN_VERSION env var expected VersionTLS10, got: $ENV_VALUE"
fi
echo "PASS: TLS_MIN_VERSION=VersionTLS10"

# --- 2. Verify the pod is running (config was accepted, no crash) ---
echo "=== Verifying pod is running ==="
POD_PHASE=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].status.phase}')
if [ "$POD_PHASE" != "Running" ]; then
  fail "Pod is not running (phase: $POD_PHASE) - Old TLS config may have caused a crash"
fi
echo "PASS: Pod is running with Old TLS configuration"

# --- 3. nmap scan to verify TLS versions ---
verify_nmap_tls_profile "old" "Old profile"

# --- 4. Functional endpoint checks ---
verify_all_endpoints "Old profile"

echo ""
echo "============================================="
echo "PASS: Old TLS profile verified"
echo "  - Configuration accepted without errors"
echo "  - TLS 1.2 and TLS 1.3 available"
echo "  - All endpoints responding correctly"
echo "============================================="
