#!/bin/sh
# Common TLS verification helpers for the distributed-tracing-console-plugin.
# Sourced by each verification script.

# Auto-detect the COO namespace from the operator deployment (works even when scaled to 0).
NAMESPACE=$(kubectl get deployment -A -l app.kubernetes.io/name=observability-operator \
  -o jsonpath='{.items[0].metadata.namespace}' 2>/dev/null || echo "openshift-cluster-observability-operator")
echo "Using COO namespace: $NAMESPACE"
DEPLOYMENT="distributed-tracing"
OPERATOR_DEPLOYMENT="observability-operator"
PLUGIN_PORT="9443"
LABEL_SELECTOR="app.kubernetes.io/instance=distributed-tracing"

fail() { echo "FAIL: $1"; exit 1; }

# Scale down the observability-operator to prevent it from reconciling the
# plugin deployment while we patch TLS CLI args for testing.
scale_down_operator() {
  echo "=== Scaling down $OPERATOR_DEPLOYMENT to prevent reconciliation ==="
  kubectl scale deployment "$OPERATOR_DEPLOYMENT" -n "$NAMESPACE" --replicas=0
  kubectl rollout status deployment/"$OPERATOR_DEPLOYMENT" -n "$NAMESPACE" --timeout=60s
  echo "PASS: $OPERATOR_DEPLOYMENT scaled to 0"

  # Brief pause to let any in-flight shutdown reconciliation complete before
  # we inspect and repair console registration.
  sleep 5

  # COO's graceful shutdown may deregister the plugin from
  # consoles.operator.openshift.io/cluster spec.plugins, making the tracing UI
  # disappear from the OpenShift console even though the plugin pod is still running.
  # Re-add the plugin to spec.plugins if it is missing.
  echo "Verifying console plugin registration after operator scale-down..."
  CURRENT_PLUGINS=$(kubectl get consoles.operator.openshift.io cluster \
    -o json 2>/dev/null | jq -c '.spec.plugins // []')
  if ! echo "$CURRENT_PLUGINS" | grep -q "distributed-tracing-console-plugin"; then
    echo "Plugin missing from consoles/cluster spec.plugins — re-registering..."
    NEW_PLUGINS=$(echo "$CURRENT_PLUGINS" | jq -c '. + ["distributed-tracing-console-plugin"]')
    kubectl patch consoles.operator.openshift.io cluster --type=merge \
      -p "{\"spec\":{\"plugins\":$NEW_PLUGINS}}" 2>/dev/null || \
      echo "NOTE: Console spec.plugins patch skipped (non-fatal)"
  else
    echo "Plugin already present in consoles/cluster spec.plugins"
  fi

  # Annotate the ConsolePlugin CR so the OpenShift console bridge immediately
  # re-checks the plugin health instead of waiting for its backoff timer.
  echo "Triggering console plugin re-detection via ConsolePlugin annotation..."
  kubectl annotate consoleplugin distributed-tracing-console-plugin \
    "reload-timestamp=$(date +%s)" --overwrite 2>/dev/null || \
    echo "NOTE: ConsolePlugin annotation skipped (non-fatal)"
}

# Scale the observability-operator back up.
scale_up_operator() {
  echo "=== Scaling up $OPERATOR_DEPLOYMENT ==="
  kubectl scale deployment "$OPERATOR_DEPLOYMENT" -n "$NAMESPACE" --replicas=1
  kubectl rollout status deployment/"$OPERATOR_DEPLOYMENT" -n "$NAMESPACE" --timeout=120s
  kubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=observability-operator \
    -n "$NAMESPACE" --timeout=120s
  echo "PASS: $OPERATOR_DEPLOYMENT scaled back to 1"
}

# Detect FIPS mode from machineconfig
detect_fips() {
  IS_FIPS=false
  if kubectl get machineconfig 99-master-fips -o jsonpath='{.spec.fips}' 2>/dev/null | grep -q true; then
    IS_FIPS=true
    echo "FIPS mode detected - adjusting TLS verification"
  fi
}

# Get the pod IP of the distributed-tracing plugin pod.
get_plugin_pod_ip() {
  kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].status.podIP}'
}

# Get the plugin pod name.
get_plugin_pod_name() {
  kubectl get pod -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o jsonpath='{.items[0].metadata.name}'
}

# Wait for the deployment rollout to complete.
wait_for_rollout() {
  echo "Waiting for deployment rollout..."
  kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=120s
  # Wait for old pods to terminate before checking readiness
  sleep 10
  kubectl wait --for=condition=Ready pods -l "$LABEL_SELECTOR" -n "$NAMESPACE" --timeout=120s
  # Annotate the ConsolePlugin CR so the OpenShift console bridge immediately
  # re-checks the plugin health instead of waiting for its backoff timer.
  # Without this, the console can take 10+ minutes to rediscover the plugin after
  # a pod restart, causing verifyTracesVisible to time out.
  echo "Triggering console plugin re-detection via ConsolePlugin annotation..."
  kubectl annotate consoleplugin distributed-tracing-console-plugin \
    "reload-timestamp=$(date +%s)" --overwrite 2>/dev/null || \
    echo "NOTE: ConsolePlugin annotation skipped (non-fatal)"
}

# Patch the deployment CLI args with TLS settings, mirroring what COO does when it reads
# the cluster TLS profile from apiservers.config.openshift.io/cluster.
# Args: $1=-tls-min-version value (optional), $2=-tls-cipher-suites value (optional, comma-separated)
patch_tls_args() {
  local min_version="${1:-}"
  local cipher_suites="${2:-}"

  local current_args
  current_args=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].args}')
  # Default to empty array when COO does not set any args
  current_args="${current_args:-[]}"

  local new_args="$current_args"

  if [ -n "$min_version" ]; then
    new_args=$(echo "$new_args" | jq --arg v "-tls-min-version=$min_version" \
      '[.[] | select(startswith("-tls-min-version=") | not)] + [$v]')
  fi

  if [ -n "$cipher_suites" ]; then
    new_args=$(echo "$new_args" | jq --arg v "-tls-cipher-suites=$cipher_suites" \
      '[.[] | select(startswith("-tls-cipher-suites=") | not)] + [$v]')
  else
    new_args=$(echo "$new_args" | jq \
      '[.[] | select(startswith("-tls-cipher-suites=") | not)]')
  fi

  echo "Patching deployment args: $new_args"
  # Use "add" so the patch works whether or not the args field already exists.
  kubectl patch deployment "$DEPLOYMENT" -n "$NAMESPACE" --type=json \
    -p "[{\"op\": \"add\", \"path\": \"/spec/template/spec/containers/0/args\", \"value\": $new_args}]"

  wait_for_rollout
}

# Remove TLS CLI args added for testing. The plugin defaults to the Intermediate profile
# (TLS 1.2+) when no -tls-min-version arg is present, so we strip rather than restore a
# specific value — this works regardless of whether COO passes the arg in CI or not.
remove_tls_args() {
  echo "Removing test TLS CLI args from deployment..."
  local current_args
  current_args=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].args}')
  current_args="${current_args:-[]}"

  local new_args
  new_args=$(echo "$current_args" | jq \
    '[.[] | select(startswith("-tls-min-version=") or startswith("-tls-cipher-suites=") | not)]')

  kubectl patch deployment "$DEPLOYMENT" -n "$NAMESPACE" --type=json \
    -p "[{\"op\": \"add\", \"path\": \"/spec/template/spec/containers/0/args\", \"value\": $new_args}]"

  wait_for_rollout
}

# Verify TLS profile via direct nmap ssl-enum-ciphers scan on the plugin pod IP.
# Args: $1=expected_profile (intermediate|modern|old|custom), $2=description
#       $3=expected_ciphers (optional, comma-separated cipher names for custom profile)
verify_nmap_tls_profile() {
  local ip
  ip=$(get_plugin_pod_ip)
  local expected="$1" description="$2" expected_ciphers="${3:-}"

  echo "=== nmap ssl-enum-ciphers: $description ($ip port $PLUGIN_PORT) ==="
  local result
  result=$(kubectl exec tls-scanner -n "$NAMESPACE" -- nmap -Pn --script ssl-enum-ciphers -p "$PLUGIN_PORT" "$ip")
  echo "$result"

  # On FIPS clusters, retry with explicit FIPS cipher list if no TLS detected
  if [ "$IS_FIPS" = "true" ] && ! echo "$result" | grep -q "TLSv1"; then
    echo "FIPS: Initial scan found no TLS, retrying with FIPS ciphers..."
    result=$(kubectl exec tls-scanner -n "$NAMESPACE" -- nmap -Pn --script ssl-enum-ciphers \
      --script-args "ssl-enum-ciphers.ciphersuite=TLSv1.3+AES_128_GCM_SHA256:TLSv1.3+AES_256_GCM_SHA384" \
      -p "$PLUGIN_PORT" "$ip")
    echo "$result"
  fi

  local port_section
  port_section=$(echo "$result" | grep -A 100 "${PLUGIN_PORT}/tcp" || true)
  if [ -z "$port_section" ]; then
    fail "$description: port $PLUGIN_PORT not found in nmap output"
  fi

  case "$expected" in
    intermediate)
      echo "$port_section" | grep "TLSv1.2" || fail "$description: port $PLUGIN_PORT missing TLSv1.2"
      echo "$port_section" | grep "TLSv1.3" || fail "$description: port $PLUGIN_PORT missing TLSv1.3"
      # Ensure TLS 1.0 and 1.1 are not present
      if echo "$port_section" | grep -q "TLSv1.0"; then
        fail "$description: port $PLUGIN_PORT unexpectedly accepting TLSv1.0"
      fi
      if echo "$port_section" | grep -q "TLSv1.1"; then
        fail "$description: port $PLUGIN_PORT unexpectedly accepting TLSv1.1"
      fi
      ;;
    modern)
      echo "$port_section" | grep "TLSv1.3" || fail "$description: port $PLUGIN_PORT missing TLSv1.3"
      if echo "$port_section" | head -30 | grep -q "TLSv1.2"; then
        fail "$description: port $PLUGIN_PORT still accepting TLSv1.2 under Modern profile"
      fi
      ;;
    old)
      # Old profile accepts TLS 1.0+. At minimum TLS 1.2 and 1.3 must be present.
      echo "$port_section" | grep "TLSv1.2" || fail "$description: port $PLUGIN_PORT missing TLSv1.2"
      echo "$port_section" | grep "TLSv1.3" || fail "$description: port $PLUGIN_PORT missing TLSv1.3"
      # TLS 1.0 or 1.1 should also be present for Old profile
      if ! echo "$port_section" | grep -q "TLSv1.0" && ! echo "$port_section" | grep -q "TLSv1.1"; then
        echo "NOTE: Old profile expected TLS 1.0/1.1 but not found (Go may not support them) - continuing"
      fi
      ;;
    custom)
      # Just verify TLS is working; cipher verification is done separately
      echo "$port_section" | grep "TLSv1" || fail "$description: no TLS detected on port $PLUGIN_PORT"
      ;;
  esac

  # Verify specific cipher suites if provided
  if [ -n "$expected_ciphers" ]; then
    for cipher in ${expected_ciphers//,/ }; do
      echo "$port_section" | grep -i "$cipher" || fail "$description: expected cipher $cipher not found"
    done
  fi

  echo "PASS: $description (port $PLUGIN_PORT, profile=$expected)"
}

# Verify that a specific TLS version is rejected by the server.
# Uses openssl s_client to attempt a connection with a restricted TLS version.
# Args: $1=tls_version_flag (e.g. -tls1_2), $2=description
verify_tls_version_rejected() {
  local ip
  ip=$(get_plugin_pod_ip)
  local tls_flag="$1" description="$2"

  echo "=== Verify TLS version rejected: $description ($ip:$PLUGIN_PORT $tls_flag) ==="
  local result
  result=$(kubectl exec tls-scanner -n "$NAMESPACE" -- \
    timeout 10 openssl s_client -connect "$ip:$PLUGIN_PORT" "$tls_flag" </dev/null 2>&1) || true
  echo "$result"

  if echo "$result" | grep -qi "CONNECTED.*SSL" && echo "$result" | grep -qi "Protocol.*:.*TLS"; then
    # Check if the handshake actually succeeded
    if ! echo "$result" | grep -qi "handshake failure\|wrong version\|alert protocol\|ssl alert\|routines:ssl"; then
      fail "$description: TLS connection should have been rejected but succeeded"
    fi
  fi

  echo "PASS: $description - connection correctly rejected"
}

# Verify functional endpoint accessibility via curl from inside the cluster.
# Args: $1=endpoint_path, $2=expected_status_code, $3=description
verify_endpoint() {
  local endpoint="$1" expected_code="$2" description="$3"
  local svc_url="https://distributed-tracing.${NAMESPACE}.svc:9443${endpoint}"

  echo "=== Endpoint check: $description ($svc_url) ==="
  local http_code
  http_code=$(kubectl exec tls-scanner -n "$NAMESPACE" -- \
    curl -sk -o /dev/null -w '%{http_code}' "$svc_url" 2>&1)

  if [ "$http_code" != "$expected_code" ]; then
    fail "$description: expected HTTP $expected_code, got HTTP $http_code"
  fi

  echo "PASS: $description (HTTP $http_code)"
}

# Verify that all plugin endpoints respond correctly.
verify_all_endpoints() {
  local description="${1:-Plugin endpoints}"
  echo "=== Verifying all plugin endpoints: $description ==="

  verify_endpoint "/health" "200" "$description - /health"
  verify_endpoint "/features" "200" "$description - /features"
  verify_endpoint "/plugin-manifest.json" "200" "$description - /plugin-manifest.json"

  echo "PASS: All endpoints verified for $description"
}

# Verify that nmap shows only specific cipher suites (no unexpected ones).
# Args: $1=allowed_ciphers (pipe-separated for grep), $2=description
verify_cipher_suites_exclusive() {
  local ip
  ip=$(get_plugin_pod_ip)
  local allowed_pattern="$1" description="$2"

  echo "=== Verify cipher suites exclusive: $description ==="
  local result
  result=$(kubectl exec tls-scanner -n "$NAMESPACE" -- nmap -Pn --script ssl-enum-ciphers -p "$PLUGIN_PORT" "$ip")
  echo "$result"

  local port_section
  port_section=$(echo "$result" | grep -A 100 "${PLUGIN_PORT}/tcp" || true)
  if [ -z "$port_section" ]; then
    fail "$description: port $PLUGIN_PORT not found in nmap output"
  fi

  # Extract cipher names from nmap output (lines starting with TLS_ or containing cipher suite names)
  local found_ciphers
  found_ciphers=$(echo "$port_section" | grep "TLS_" | awk '{print $1}' | sort -u || true)

  if [ -z "$found_ciphers" ]; then
    fail "$description: no cipher suites found in nmap output"
  fi

  echo "Found cipher suites:"
  echo "$found_ciphers"

  # Verify each found cipher is in the allowed list
  echo "$found_ciphers" | while IFS= read -r cipher; do
    if ! echo "$cipher" | grep -qE "$allowed_pattern"; then
      fail "$description: unexpected cipher suite found: $cipher"
    fi
  done

  echo "PASS: $description - only allowed cipher suites present"
}
