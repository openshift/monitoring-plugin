#!/bin/bash
# Verify that the distributed-tracing-console-plugin backend dynamically reloads
# its TLS certificate after the serving secret is rotated, without a pod restart.
#
# Regression test for: GetConfigForClient / AddListener / certKeyPair.Run were
# not wired up, so the server served its initial cert forever even after the
# cert file on disk changed.
set -euo pipefail

NAMESPACE="${NAMESPACE:-$(kubectl get deployment -A -l app.kubernetes.io/name=observability-operator \
  -o jsonpath='{.items[0].metadata.namespace}' 2>/dev/null || echo "openshift-cluster-observability-operator")}"

DEPLOYMENT="distributed-tracing"
PLUGIN_PORT="9443"
LABEL_SELECTOR="app.kubernetes.io/instance=distributed-tracing"
SECRET_NAME="distributed-tracing"
CERT_MOUNT_PATH="/var/serving-cert/tls.crt"

fail() { echo "FAIL: $*"; exit 1; }

openssl_serial() {
  local ip="$1"
  kubectl exec tls-scanner -n "$NAMESPACE" -- bash -c \
    "echo '' | timeout 10 openssl s_client -connect ${ip}:${PLUGIN_PORT} 2>/dev/null \
     | openssl x509 -noout -serial 2>/dev/null" 2>/dev/null || echo ""
}

echo "Using namespace: $NAMESPACE"
echo "Deployment: $DEPLOYMENT"

# ---------------------------------------------------------------------------
# Step 1: Record pre-rotation state
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 1: Pre-rotation state ==="

OLD_SECRET_SERIAL=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -serial 2>/dev/null)
echo "Secret cert serial (pre-rotation):  $OLD_SECRET_SERIAL"

# Capture the concrete pod name and IP once; reuse throughout the test so all
# checks reference the same pod even if the label selector matches multiple pods.
POD_NAME=$(kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}')
[ -n "$POD_NAME" ] || fail "could not find a Running plugin pod"

PLUGIN_IP=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.status.podIP}')
[ -n "$PLUGIN_IP" ] || fail "could not get IP of pod $POD_NAME"

POD_TS=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.metadata.creationTimestamp}')

OLD_SERVED_SERIAL=$(openssl_serial "$PLUGIN_IP")
echo "Served cert serial (pre-rotation):  ${OLD_SERVED_SERIAL:-<unavailable>}"
echo "Plugin pod: $POD_NAME (created: $POD_TS)"

# ---------------------------------------------------------------------------
# Step 2: Delete secret — service-ca regenerates it with a new cert
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 2: Rotate the TLS secret ==="
kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
echo "Secret deleted — waiting for service-ca to regenerate..."

ELAPSED=0; TIMEOUT=120
while [ $ELAPSED -lt $TIMEOUT ]; do
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null && break
  sleep 2; ELAPSED=$((ELAPSED + 2))
done
[ $ELAPSED -lt $TIMEOUT ] || fail "secret not regenerated within ${TIMEOUT}s"
echo "Secret regenerated after ~${ELAPSED}s"

NEW_SECRET_SERIAL=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -serial 2>/dev/null)
echo "Secret cert serial (post-rotation): $NEW_SECRET_SERIAL"

[ "$OLD_SECRET_SERIAL" != "$NEW_SECRET_SERIAL" ] \
  || fail "serial unchanged after secret regeneration — service-ca may not have rotated the cert"
echo "PASS: New cert issued ($OLD_SECRET_SERIAL → $NEW_SECRET_SERIAL)"

# ---------------------------------------------------------------------------
# Step 3: Wait for the new cert to propagate to the pod's volume mount
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 3: Wait for volume propagation ==="

EXPECTED_HASH=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | sha256sum | awk '{print $1}')

ELAPSED=0; TIMEOUT=180
while [ $ELAPSED -lt $TIMEOUT ]; do
  ACTUAL_HASH=$(kubectl exec "deployment/$DEPLOYMENT" -n "$NAMESPACE" -- \
    cat "$CERT_MOUNT_PATH" 2>/dev/null | sha256sum | awk '{print $1}') || true
  [ "$EXPECTED_HASH" = "$ACTUAL_HASH" ] && break
  [ $((ELAPSED % 30)) -eq 0 ] && echo "Waiting for volume sync... (${ELAPSED}s/${TIMEOUT}s)"
  sleep 5; ELAPSED=$((ELAPSED + 5))
done
[ $ELAPSED -lt $TIMEOUT ] || fail "cert volume did not sync within ${TIMEOUT}s"
echo "PASS: Volume propagation confirmed after ${ELAPSED}s"

# ---------------------------------------------------------------------------
# Step 4: Verify the server dynamically serves the new cert without restart
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 4: Verify dynamic cert reload (no pod restart) ==="

SERVED_SERIAL=""
ELAPSED=0; TIMEOUT=180
while [ $ELAPSED -lt $TIMEOUT ]; do
  SERVED_SERIAL=$(openssl_serial "$PLUGIN_IP")
  [ "$SERVED_SERIAL" = "$NEW_SECRET_SERIAL" ] && break
  [ $((ELAPSED % 30)) -eq 0 ] \
    && echo "Waiting for reload... (${ELAPSED}s/${TIMEOUT}s) served=${SERVED_SERIAL:-unknown}"
  sleep 5; ELAPSED=$((ELAPSED + 5))
done

if [ "$SERVED_SERIAL" != "$NEW_SECRET_SERIAL" ]; then
  fail "server did not pick up new cert within ${TIMEOUT}s (served=${SERVED_SERIAL:-unknown}, expected=${NEW_SECRET_SERIAL})"
fi
echo "PASS: Dynamic cert reload confirmed after ${ELAPSED}s"

# ---------------------------------------------------------------------------
# Step 5: Verify the pod was NOT restarted
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 5: Verify pod was not restarted ==="
CURRENT_POD=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")
CURRENT_TS=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.metadata.creationTimestamp}' 2>/dev/null || echo "")

if [ "$CURRENT_POD" = "$POD_NAME" ] && [ "$CURRENT_TS" = "$POD_TS" ]; then
  echo "PASS: Same pod running (name=$POD_NAME, creationTimestamp=$POD_TS)"
else
  fail "pod was restarted: before=$POD_NAME/$POD_TS after=$CURRENT_POD/$CURRENT_TS"
fi

# ---------------------------------------------------------------------------
# Step 6: Verify the service endpoint is healthy with the new cert
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 6: Verify /health endpoint after cert rotation ==="
SVC_URL="https://${DEPLOYMENT}.${NAMESPACE}.svc:${PLUGIN_PORT}/health"
HTTP_CODE=$(kubectl exec tls-scanner -n "$NAMESPACE" -- \
  curl -sk -o /dev/null -w '%{http_code}' "$SVC_URL" 2>/dev/null)
[ "$HTTP_CODE" = "200" ] || fail "/health returned HTTP $HTTP_CODE (expected 200)"
echo "PASS: /health → HTTP 200"

# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "PASS: Certificate rotation with dynamic reload verified"
echo "  Pre-rotation serial:  $OLD_SECRET_SERIAL"
echo "  Post-rotation serial: $NEW_SECRET_SERIAL"
echo "  Served serial:        $SERVED_SERIAL"
echo "  Pod not restarted:    $POD_NAME"
echo "============================================="
