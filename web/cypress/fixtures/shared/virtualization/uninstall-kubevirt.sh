#!/usr/bin/env bash
# Uninstall OpenShift Virtualization (KubeVirt) from a cluster.
# Mirrors the cleanup logic in virtualization-commands.ts.
#
# Usage:
#   ./uninstall-kubevirt.sh [--namespace <ns>] [--kubeconfig <path>]
#
# Defaults:
#   namespace:  openshift-cnv
#   kubeconfig: $KUBECONFIG (or ~/.kube/config)

set -euo pipefail

NAMESPACE="${NAMESPACE:-openshift-cnv}"
KUBECONFIG_PATH="${KUBECONFIG:-${HOME}/.kube/config}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)  NAMESPACE="$2";       shift 2 ;;
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

run() {
  echo "+ $*"
  if ! "$@"; then
    echo "  (command failed, continuing)" >&2
  fi
}

# Deleting the namespace/CRDs below removes the backing services for any
# aggregated APIServices (e.g. virt-api, cdi-api), but OLM does not always
# clean up the APIService objects themselves. Leftover APIServices in
# "ServiceNotFound" state break cluster-wide API discovery, which can
# silently stall unrelated namespace/CR deletions elsewhere in the cluster
# (e.g. acm-uninstall.sh). Detect and remove them so this script doesn't
# leave landmines for other cleanup jobs.
cleanup_broken_apiservices() {
  echo "--- Checking for broken APIServices (stale discovery entries) ---"
  local broken
  broken=$(oc get apiservices -o json --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null \
    | jq -r '.items[] | select(.status.conditions[]? | .status=="False" and .reason=="ServiceNotFound") | .metadata.name')
  if [[ -n "${broken}" ]]; then
    echo "Found broken APIServices pointing at missing services:"
    echo "${broken}"
    while IFS= read -r name; do
      [[ -z "${name}" ]] && continue
      run oc delete apiservice "${name}" --ignore-not-found --kubeconfig "${KUBECONFIG_PATH}"
    done <<< "${broken}"
  else
    echo "No broken APIServices found."
  fi
}

echo "=== Uninstalling OpenShift Virtualization from namespace ${NAMESPACE} ==="

echo ""
echo "--- Removing finalizers from HyperConverged ---"
run oc patch hyperconverged.hco.kubevirt.io/kubevirt-hyperconverged \
  -n "${NAMESPACE}" \
  -p '{"metadata":{"finalizers":[]}}' \
  --type=merge \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Removing finalizers from KubeVirt ---"
run oc patch kubevirt.kubevirt.io/kubevirt \
  -n "${NAMESPACE}" \
  --type=merge \
  -p '{"metadata":{"finalizers":[]}}' \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Deleting HyperConverged instance ---"
run oc delete HyperConverged kubevirt-hyperconverged \
  -n "${NAMESPACE}" \
  --ignore-not-found \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Removing subscription ---"
run oc delete subscription kubevirt-hyperconverged \
  -n "${NAMESPACE}" \
  --ignore-not-found \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Removing CSV ---"
run oc delete csv \
  -n "${NAMESPACE}" \
  -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv \
  --ignore-not-found \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Deleting namespace ${NAMESPACE} ---"
if ! oc delete namespace "${NAMESPACE}" \
  --ignore-not-found \
  --timeout=60s \
  --kubeconfig "${KUBECONFIG_PATH}" 2>&1; then

  echo "Namespace stuck in Terminating, removing finalizers..."
  oc get namespace "${NAMESPACE}" -o json --kubeconfig "${KUBECONFIG_PATH}" \
    | jq '.spec.finalizers = []' \
    | oc replace --raw "/api/v1/namespaces/${NAMESPACE}/finalize" -f - \
        --kubeconfig "${KUBECONFIG_PATH}" || true
fi

echo ""
echo "--- Cleaning up orphaned APIServices left behind by ${NAMESPACE} ---"
cleanup_broken_apiservices

echo ""
echo "--- Deleting CRDs ---"
run oc delete crd \
  -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv \
  --ignore-not-found \
  --timeout=120s \
  --kubeconfig "${KUBECONFIG_PATH}"

echo ""
echo "--- Re-checking for broken APIServices after CRD deletion ---"
cleanup_broken_apiservices

echo ""
echo "=== OpenShift Virtualization uninstall complete ==="
