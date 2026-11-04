#!/bin/bash
# Uninstall ACM test resources.
#
# Usage:
#   ./acm-uninstall.sh [--kubeconfig <path>]
#
# Defaults:
#   kubeconfig: $KUBECONFIG (or ~/.kube/config)
#
# Self-heals against a common failure mode: leftover "ServiceNotFound" APIServices
# (e.g. left behind by uninstall-kubevirt.sh) break cluster-wide API discovery,
# which silently stalls namespace/CR termination for *any* resource, including
# MultiClusterHub/MultiClusterEngine here. See cleanup_broken_apiservices().
#
# Every delete below is non-blocking (--wait=false) followed by a bounded wait,
# so this script can never hang indefinitely the way a plain `oc delete` can.
set -uo pipefail
set -x

KUBECONFIG_PATH="${KUBECONFIG:-${HOME}/.kube/config}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

echo "[ACM Uninstall] Using KUBECONFIG=${KUBECONFIG_PATH}"

run() {
  echo "+ $*"
  if ! "$@" --kubeconfig "${KUBECONFIG_PATH}"; then
    echo "  (command failed, continuing)" >&2
  fi
}

cleanup_broken_apiservices() {
  echo "[ACM Uninstall] Checking for broken APIServices (stale discovery entries)..."
  local broken
  broken=$(oc get apiservices -o json --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null \
    | jq -r '.items[] | select(.status.conditions[]? | .status=="False" and .reason=="ServiceNotFound") | .metadata.name')
  if [[ -n "${broken}" ]]; then
    echo "[ACM Uninstall] Found broken APIServices pointing at missing services (these can stall unrelated namespace/CR deletions):"
    echo "${broken}"
    while IFS= read -r name; do
      [[ -z "${name}" ]] && continue
      run oc delete apiservice "${name}" --ignore-not-found
    done <<< "${broken}"
  else
    echo "[ACM Uninstall] No broken APIServices found."
  fi
}

# Usage: wait_or_force_delete <kind> <name> [-n <namespace>] <timeout-seconds>
wait_or_force_delete() {
  local kind="$1" name="$2"
  shift 2
  local ns_args=()
  if [[ "${1:-}" == "-n" ]]; then
    ns_args=("-n" "$2")
    shift 2
  fi
  local timeout="${1:-180}"

  if oc wait "${kind}" "${name}" ${ns_args[@]+"${ns_args[@]}"} --for=delete --timeout="${timeout}s" --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null; then
    return 0
  fi

  echo "[ACM Uninstall] ${kind}/${name} still present after ${timeout}s; attempting self-heal..."
  cleanup_broken_apiservices

  if oc wait "${kind}" "${name}" ${ns_args[@]+"${ns_args[@]}"} --for=delete --timeout=60s --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null; then
    return 0
  fi

  echo "[ACM Uninstall] ${kind}/${name} still stuck; forcibly clearing finalizers..."
  oc get "${kind}" "${name}" ${ns_args[@]+"${ns_args[@]}"} -o json --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null \
    | jq '.metadata.finalizers = []' \
    | oc replace -f - --kubeconfig "${KUBECONFIG_PATH}" || true
}

force_delete_namespace() {
  local ns="$1"
  echo "[ACM Uninstall] Namespace ${ns} stuck in Terminating, removing finalizers..."
  oc get namespace "${ns}" -o json --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null \
    | jq '.spec.finalizers = []' \
    | oc replace --raw "/api/v1/namespaces/${ns}/finalize" -f - --kubeconfig "${KUBECONFIG_PATH}" || true
}

delete_namespace() {
  local ns="$1" timeout="${2:-120}"
  echo "[ACM Uninstall] Deleting namespace ${ns}..."
  if ! oc delete ns "${ns}" --ignore-not-found=true --timeout="${timeout}s" --kubeconfig "${KUBECONFIG_PATH}" 2>&1; then
    cleanup_broken_apiservices
    force_delete_namespace "${ns}"
  fi
}

# --- Step 0: pre-flight self-heal ---
# Do this first so leftovers from other cleanup scripts (e.g. uninstall-kubevirt.sh)
# don't stall the deletions below.
cleanup_broken_apiservices

# --- Step 1: delete MultiClusterObservability (MCO) ---
echo "[ACM Uninstall] Deleting MultiClusterObservability (MCO)..."
run oc delete MultiClusterObservability observability -n open-cluster-management-observability --ignore-not-found=true --wait=false
wait_or_force_delete MultiClusterObservability observability -n open-cluster-management-observability 180

# --- Step 2: delete MinIO, PVC, Secret, Service ---
echo "[ACM Uninstall] Cleaning up MinIO and related resources..."
run oc delete deploy minio -n open-cluster-management-observability --ignore-not-found=true
run oc delete pvc minio -n open-cluster-management-observability --ignore-not-found=true
run oc delete secret thanos-object-storage -n open-cluster-management-observability --ignore-not-found=true
run oc delete svc minio -n open-cluster-management-observability --ignore-not-found=true

# --- Step 3: delete MultiClusterHub, and its MultiClusterEngine dependency ---
echo "[ACM Uninstall] Deleting MultiClusterHub..."
run oc delete MultiClusterHub multiclusterhub -n open-cluster-management --ignore-not-found=true --wait=false
wait_or_force_delete MultiClusterHub multiclusterhub -n open-cluster-management 300

echo "[ACM Uninstall] Ensuring MultiClusterEngine is cleaned up..."
run oc delete MultiClusterEngine multiclusterengine --ignore-not-found=true --wait=false
wait_or_force_delete MultiClusterEngine multiclusterengine 180

# --- Step 4: delete Subscription and OperatorGroup ---
echo "[ACM Uninstall] Deleting ACM Operator Subscription & OperatorGroup..."
run oc delete sub advanced-cluster-management -n open-cluster-management --ignore-not-found=true
run oc delete og og-global -n open-cluster-management --ignore-not-found=true

# --- Step 5: delete namespaces ---
echo "[ACM Uninstall] Deleting ACM-related namespaces..."
delete_namespace open-cluster-management-observability 120
delete_namespace open-cluster-management-hub 120
delete_namespace open-cluster-management 120

# --- Step 6: clean up orphaned APIServices left behind by ACM ---
echo "[ACM Uninstall] Re-checking for broken APIServices after namespace deletion..."
cleanup_broken_apiservices

# # --- Step 7: clean up CRDs (optional) ---
# echo "[ACM Uninstall] Cleaning up CRDs (optional cleanup)..."
# oc delete crd multiclusterhubs.operator.open-cluster-management.io --ignore-not-found=true --kubeconfig "${KUBECONFIG_PATH}"
# oc delete crd multiclusterobservabilities.observability.open-cluster-management.io --ignore-not-found=true --kubeconfig "${KUBECONFIG_PATH}"

echo "[ACM Uninstall] Completed cleanup."
