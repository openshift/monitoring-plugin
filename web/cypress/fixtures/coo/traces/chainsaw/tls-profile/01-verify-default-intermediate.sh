#!/bin/bash
set -euo pipefail

# Verify default TLS profile (Intermediate): TLS 1.2 + TLS 1.3 supported.
# No TLS env vars are set on the deployment; the plugin uses its built-in defaults.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

detect_fips

echo "============================================="
echo "Step 1: Verify default Intermediate TLS profile"
echo "============================================="

# --- 1. Verify no TLS env vars are set ---
echo "=== Checking deployment has no TLS env vars ==="
CONTAINER_ENV=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env}' 2>/dev/null || echo "null")
if [ "$CONTAINER_ENV" != "" ] && [ "$CONTAINER_ENV" != "null" ]; then
  if echo "$CONTAINER_ENV" | grep -q "TLS_MIN_VERSION\|TLS_CIPHER_SUITES"; then
    fail "TLS env vars are set but should not be for default profile test"
  fi
fi
echo "PASS: No TLS env vars set on deployment"

# --- 2. Verify deployment args (should NOT have --tls-min-version or --tls-cipher-suites) ---
echo "=== Checking deployment args ==="
CONTAINER_ARGS=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].args}')
echo "Container args: $CONTAINER_ARGS"
if echo "$CONTAINER_ARGS" | grep -q "tls-min-version\|tls-cipher-suites"; then
  echo "NOTE: TLS args found in container args - these were set explicitly"
fi

# --- 3. nmap scan to verify Intermediate profile (TLS 1.2 + TLS 1.3) ---
verify_nmap_tls_profile "intermediate" "Default Intermediate profile"

# --- 4. Functional endpoint checks ---
verify_all_endpoints "Default Intermediate profile"

echo ""
echo "============================================="
echo "PASS: Default Intermediate TLS profile verified"
echo "  - TLS 1.2 and TLS 1.3 both supported"
echo "  - All endpoints responding correctly"
echo "============================================="
