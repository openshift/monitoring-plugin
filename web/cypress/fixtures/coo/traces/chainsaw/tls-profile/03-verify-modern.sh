#!/bin/bash
set -euo pipefail

# Verify Modern TLS profile: only TLS 1.3 should be accepted, TLS 1.2 must be rejected.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

detect_fips

echo "============================================="
echo "Step 3: Verify Modern TLS profile (TLS 1.3 only)"
echo "============================================="

# --- 1. Verify TLS_MIN_VERSION env var is set ---
echo "=== Checking TLS_MIN_VERSION env var ==="
ENV_VALUE=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TLS_MIN_VERSION")].value}')
if [ "$ENV_VALUE" != "VersionTLS13" ]; then
  fail "TLS_MIN_VERSION env var expected VersionTLS13, got: $ENV_VALUE"
fi
echo "PASS: TLS_MIN_VERSION=VersionTLS13"

# --- 2. nmap scan to verify Modern profile (TLS 1.3 only) ---
verify_nmap_tls_profile "modern" "Modern profile"

# --- 3. Verify TLS 1.2 connections are rejected ---
verify_tls_version_rejected "-tls1_2" "TLS 1.2 rejected under Modern profile"

# --- 4. Functional endpoint checks (via TLS 1.3) ---
verify_all_endpoints "Modern profile"

echo ""
echo "============================================="
echo "PASS: Modern TLS profile verified"
echo "  - Only TLS 1.3 accepted"
echo "  - TLS 1.2 correctly rejected"
echo "  - All endpoints responding correctly"
echo "============================================="
