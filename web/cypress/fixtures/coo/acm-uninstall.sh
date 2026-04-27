#!/bin/bash
# Uninstall ACM test resources. Runs automatically as part of beforeBlockACM cleanup.
set -euo pipefail
echo "[ACM Uninstall] Using KUBECONFIG=${KUBECONFIG:-~/.kube/config}"

# --- Step 1: delete MultiClusterObservability ---
echo "[ACM Uninstall] Deleting MultiClusterObservability (MCO)..."
oc delete MultiClusterObservability observability --ignore-not-found=true --timeout=120s || true

# --- Step 2: delete MinIO, PVC, Secret, Service ---
echo "[ACM Uninstall] Cleaning up MinIO and related resources..."
oc delete deploy minio -n open-cluster-management-observability --ignore-not-found=true || true
oc delete pvc minio -n open-cluster-management-observability --ignore-not-found=true || true
oc delete secret thanos-object-storage -n open-cluster-management-observability --ignore-not-found=true || true
oc delete svc minio -n open-cluster-management-observability --ignore-not-found=true || true

# --- Step 3: delete MultiClusterHub ---
echo "[ACM Uninstall] Deleting MultiClusterHub..."
oc patch multiclusterhub multiclusterhub -n open-cluster-management -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
oc delete MultiClusterHub multiclusterhub -n open-cluster-management --ignore-not-found=true --timeout=120s || true
oc wait MultiClusterHub multiclusterhub -n open-cluster-management --for=delete --timeout=120s 2>/dev/null || true

# --- Step 4: delete MultiClusterEngine if present ---
echo "[ACM Uninstall] Cleaning up MultiClusterEngine..."
for mce in $(oc get multiclusterengine -o name 2>/dev/null); do
  oc patch "$mce" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
  oc delete "$mce" --ignore-not-found=true --timeout=120s || true
done

# --- Step 5: delete ClusterManager resources ---
echo "[ACM Uninstall] Cleaning up ClusterManager..."
for cm in $(oc get clustermanagers -o name 2>/dev/null); do
  oc patch "$cm" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
  oc delete "$cm" --ignore-not-found=true --timeout=60s || true
done

# --- Step 6: delete Subscription, CSV, and OperatorGroup ---
echo "[ACM Uninstall] Deleting ACM Operator Subscription, CSV & OperatorGroup..."
oc delete sub advanced-cluster-management -n open-cluster-management --ignore-not-found=true || true
oc delete csv -n open-cluster-management -l operators.coreos.com/advanced-cluster-management.open-cluster-management --ignore-not-found=true || true
oc delete sub multicluster-engine -n multicluster-engine --ignore-not-found=true 2>/dev/null || true
oc delete csv -n multicluster-engine -l operators.coreos.com/multicluster-engine.multicluster-engine --ignore-not-found=true 2>/dev/null || true
oc delete og og-global -n open-cluster-management --ignore-not-found=true || true

# --- Step 7: patch finalizers on all ACM/MCE CR instances ---
echo "[ACM Uninstall] Cleaning up CR instances with finalizers..."

patch_all_instances() {
  local crd_name="$1"
  if ! oc get crd "$crd_name" &>/dev/null; then
    return 0
  fi
  local items
  items=$(oc get "$crd_name" -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  for item in $items; do
    local ns name
    ns=$(echo "$item" | cut -d/ -f1)
    name=$(echo "$item" | cut -d/ -f2)
    if [ -z "$name" ]; then continue; fi
    if [ -n "$ns" ] && [ "$ns" != " " ]; then
      oc patch "$crd_name" "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
    else
      oc patch "$crd_name" "$name" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
    fi
  done
}

for crd_name in \
  managedclusters.cluster.open-cluster-management.io \
  managedclustersets.cluster.open-cluster-management.io \
  managedclusteraddons.addon.open-cluster-management.io \
  clustermanagementaddons.addon.open-cluster-management.io \
  manifestworks.work.open-cluster-management.io \
  searches.search.open-cluster-management.io \
  managedclusterinfos.internal.open-cluster-management.io \
  observabilityaddons.observability.open-cluster-management.io \
  multiclusterobservabilities.observability.open-cluster-management.io; do
  patch_all_instances "$crd_name"
done

# --- Step 8: delete namespaces ---
echo "[ACM Uninstall] Deleting ACM-related namespaces..."
for ns in open-cluster-management-observability open-cluster-management-global-set multicluster-engine open-cluster-management open-cluster-management-hub; do
  if oc get ns "$ns" &>/dev/null; then
    oc delete ns "$ns" --ignore-not-found=true --timeout=120s || true
    if oc get ns "$ns" -o jsonpath='{.status.phase}' 2>/dev/null | grep -q Terminating; then
      echo "[ACM Uninstall] Namespace $ns stuck in Terminating, removing finalizers..."
      oc get ns "$ns" -o json | python3 -c "import sys,json; ns=json.load(sys.stdin); ns['spec']['finalizers']=[]; json.dump(ns,sys.stdout)" \
        | oc replace --raw "/api/v1/namespaces/$ns/finalize" -f - || true
    fi
  fi
done

# --- Step 9: clean up CRDs ---
echo "[ACM Uninstall] Cleaning up ACM/MCE CRDs..."
crd_list=$(oc get crd -o name 2>/dev/null | grep -E 'open-cluster-management|multicluster' || true)
if [ -n "$crd_list" ]; then
  for crd in $crd_list; do
    crd_name=$(echo "$crd" | sed 's|customresourcedefinition.apiextensions.k8s.io/||')
    echo "[ACM Uninstall]   Cleaning CRD: $crd_name"
    # Remove conversion webhooks and finalizers from the CRD itself so it can be deleted
    oc get crd "$crd_name" -o json 2>/dev/null | python3 -c "
import sys, json
crd = json.load(sys.stdin)
if 'spec' in crd and 'conversion' in crd['spec']:
    crd['spec']['conversion'] = {'strategy': 'None'}
crd['metadata']['finalizers'] = []
json.dump(crd, sys.stdout)
" | oc replace -f - 2>/dev/null || true
  done
  sleep 5
  remaining=$(oc get crd -o name 2>/dev/null | grep -E 'open-cluster-management|multicluster' || true)
  if [ -n "$remaining" ]; then
    echo "$remaining" | xargs oc delete --ignore-not-found=true --timeout=60s || true
  fi
fi

# --- Step 10: final verification ---
final_crds=$(oc get crd -o name 2>/dev/null | grep -E 'open-cluster-management|multicluster' || true)
if [ -n "$final_crds" ]; then
  echo "[ACM Uninstall] WARNING: Some CRDs still remain:"
  echo "$final_crds"
  for crd in $final_crds; do
    crd_name=$(echo "$crd" | sed 's|customresourcedefinition.apiextensions.k8s.io/||')
    oc get crd "$crd_name" -o json 2>/dev/null | python3 -c "
import sys, json
crd = json.load(sys.stdin)
crd['spec']['conversion'] = {'strategy': 'None'}
crd['metadata']['finalizers'] = []
json.dump(crd, sys.stdout)
" | oc replace -f - 2>/dev/null || true
  done
  sleep 5
fi

echo "[ACM Uninstall] Completed cleanup."
