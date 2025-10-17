#!/bin/bash
set -eux
echo "[ACM Uninstall] Using KUBECONFIG=${KUBECONFIG:-~/.kube/config}"

# --- Step 1: delete MultiClusterObservability ---
echo "[ACM Uninstall] Deleting MultiClusterObservability (MCO)..."
oc delete MultiClusterObservability observability -n open-cluster-management-observability --ignore-not-found=true

# --- Step 2: delete MinIO、PVC、Secret、Service ---
echo "[ACM Uninstall] Cleaning up MinIO and related resources..."
oc delete deploy minio -n open-cluster-management-observability --ignore-not-found=true
oc delete pvc minio -n open-cluster-management-observability --ignore-not-found=true
oc delete secret thanos-object-storage -n open-cluster-management-observability --ignore-not-found=true
oc delete svc minio -n open-cluster-management-observability --ignore-not-found=true

# --- Step 3: delete MultiClusterHub ---
echo "[ACM Uninstall] Deleting MultiClusterHub..."
oc delete MultiClusterHub multiclusterhub -n open-cluster-management --ignore-not-found=true

# wait for MultiClusterHub deleted
echo "[ACM Uninstall] Waiting for MultiClusterHub cleanup..."
oc wait MultiClusterHub multiclusterhub -n open-cluster-management --for=delete --timeout=180s || true

# --- Step 4: delete Subscription and OperatorGroup ---
echo "[ACM Uninstall] Deleting ACM Operator Subscription & OperatorGroup..."
oc delete sub advanced-cluster-management -n open-cluster-management --ignore-not-found=true
oc delete og og-global -n open-cluster-management --ignore-not-found=true

# --- Step 5: delete namespace ---
echo "[ACM Uninstall] Deleting ACM-related namespaces..."
oc delete ns open-cluster-management-observability --ignore-not-found=true
oc delete ns open-cluster-management --ignore-not-found=true

# # --- Step 6: clean up CRDs（optional）---
# echo "[ACM Uninstall] Cleaning up CRDs (optional cleanup)..."
# oc delete crd multiclusterhubs.operator.open-cluster-management.io --ignore-not-found=true
# oc delete crd multiclusterobservabilities.observability.open-cluster-management.io --ignore-not-found=true

# --- Step 7: Pod / Finalizer ---
# echo "[ACM Uninstall] Removing potential finalizers..."
# oc get ns open-cluster-management-observability -o json | jq '.spec.finalizers=[]' | oc replace --raw "/api/v1/namespaces/open-cluster-management-observability/finalize" -f - || true
# oc get ns open-cluster-management -o json | jq '.spec.finalizers=[]' | oc replace --raw "/api/v1/namespaces/open-cluster-management/finalize" -f - || true

echo "[ACM Uninstall] ✅ Completed cleanup."
