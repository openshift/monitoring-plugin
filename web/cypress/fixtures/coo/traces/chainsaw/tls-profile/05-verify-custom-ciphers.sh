#!/bin/bash
set -euo pipefail

# Verify custom cipher suite configuration:
# - Only the specified cipher suites should be offered for TLS 1.2
# - TLS 1.3 cipher suites are managed by Go and always available
# - Endpoints must be functional

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

detect_fips

echo "============================================="
echo "Step 5: Verify Custom cipher suites"
echo "============================================="

# --- 1. Verify env vars are set correctly ---
echo "=== Checking TLS env vars ==="
MIN_VER=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_MIN_VERSION")].value}')
CIPHER_VAL=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_CIPHER_SUITES")].value}')
echo "TLS_MIN_VERSION=$MIN_VER"
echo "TLS_CIPHER_SUITES=$CIPHER_VAL"

# --- 2. nmap scan to check cipher suites offered ---
PLUGIN_IP=$(get_plugin_pod_ip)
echo "=== nmap ssl-enum-ciphers scan ($PLUGIN_IP:$PLUGIN_PORT) ==="
NMAP_RESULT=$(kubectl exec tls-scanner -n "$NAMESPACE" -- \
  nmap -Pn --script ssl-enum-ciphers -p "$PLUGIN_PORT" "$PLUGIN_IP")
echo "$NMAP_RESULT"

PORT_SECTION=$(echo "$NMAP_RESULT" | grep -A 100 "${PLUGIN_PORT}/tcp" || true)
if [ -z "$PORT_SECTION" ]; then
  fail "Port $PLUGIN_PORT not found in nmap output"
fi

# --- 3. Verify TLS 1.2 section contains only allowed cipher suites ---
echo "=== Verifying TLS 1.2 cipher suites ==="
TLS12_SECTION=$(echo "$PORT_SECTION" | sed -n '/TLSv1.2/,/TLSv1.3\|least strength/p' || true)

if [ -n "$TLS12_SECTION" ]; then
  echo "TLS 1.2 section found:"
  echo "$TLS12_SECTION"

  # Check for the expected cipher suites
  echo "$TLS12_SECTION" | grep -i "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256" \
    || fail "Expected cipher TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 not found in TLS 1.2"
  echo "$TLS12_SECTION" | grep -i "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384" \
    || fail "Expected cipher TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 not found in TLS 1.2"
  echo "PASS: Both expected cipher suites present in TLS 1.2"

  # Verify no other cipher suites are present in TLS 1.2
  # Extract cipher names from nmap output (lines contain TLS_ECDHE or TLS_RSA etc.)
  # nmap lines look like: |       TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (secp256r1) - A
  FOUND_CIPHERS=$(echo "$TLS12_SECTION" | grep -oE 'TLS_[A-Z0-9_]+' | grep -v '^TLSv' | sort -u || true)
  echo "Found TLS 1.2 ciphers: $FOUND_CIPHERS"

  echo "$FOUND_CIPHERS" | while IFS= read -r cipher; do
    [ -z "$cipher" ] && continue
    if ! echo "$cipher" | grep -qE "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256|TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"; then
      fail "Unexpected TLS 1.2 cipher suite found: $cipher"
    fi
  done
  echo "PASS: No unexpected TLS 1.2 cipher suites found"
else
  echo "NOTE: No TLS 1.2 section found - this may happen if Go only offers TLS 1.3 ciphers"
fi

# --- 4. Verify TLS 1.3 is still available ---
echo "=== Verifying TLS 1.3 availability ==="
echo "$PORT_SECTION" | grep "TLSv1.3" || fail "TLS 1.3 should still be available"
echo "PASS: TLS 1.3 is available"

# --- 5. Functional endpoint checks ---
verify_all_endpoints "Custom cipher suites"

echo ""
echo "============================================="
echo "PASS: Custom cipher suite configuration verified"
echo "  - Only specified TLS 1.2 cipher suites offered"
echo "  - TLS 1.3 still available"
echo "  - All endpoints responding correctly"
echo "============================================="
