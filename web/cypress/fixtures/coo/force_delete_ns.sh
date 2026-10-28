#!/bin/bash

# Script to force-delete a Kubernetes Namespace stuck in a 'Terminating' state
# by automatically clearing its finalizers using sed and tr (instead of jq).

NAMESPACE=$1
KUBECONFIG_PATH=$2

echo "NAMESPACE: $NAMESPACE"
echo "KUBECONFIG_PATH: $KUBECONFIG_PATH"

# --- Input Validation ---
if [ -z "$NAMESPACE" ]; then
  echo "Error: Please provide the namespace name as the first argument."
  echo "Usage: ./force-delete-ns.sh <namespace-name> [kubeconfig-path]"
  exit 1
fi

# Build kubeconfig flag if provided
KUBECONFIG_FLAG=""
if [ -n "$KUBECONFIG_PATH" ]; then
  KUBECONFIG_FLAG="--kubeconfig $KUBECONFIG_PATH"
fi

# Check if the namespace exists
if ! oc get namespace "$NAMESPACE" $KUBECONFIG_FLAG &> /dev/null; then
  echo "Namespace '$NAMESPACE' not found or already deleted."
  exit 0
fi

echo "Attempting to force-delete namespace '$NAMESPACE' by removing finalizers..."

# Step 1: Remove finalizers from common problematic resources
echo "Checking for resources with finalizers in namespace '$NAMESPACE'..."
# Focus on common resources that have finalizers (much faster than checking everything)
RESOURCE_TYPES="perses,persesdashboard,persistentvolumeclaims,pods,services,deployments,statefulsets,daemonsets"

for resource_type in $(echo $RESOURCE_TYPES | tr ',' ' '); do
  oc get "$resource_type" -n "$NAMESPACE" $KUBECONFIG_FLAG -o name 2>/dev/null | \
    while read -r item; do
      if [ -n "$item" ]; then
        # Check if the resource has finalizers
        HAS_FINALIZERS=$(oc get "$item" -n "$NAMESPACE" $KUBECONFIG_FLAG -o jsonpath='{.metadata.finalizers}' 2>/dev/null || echo "")
        if [ -n "$HAS_FINALIZERS" ] && [ "$HAS_FINALIZERS" != "[]" ]; then
          echo "  Removing finalizers from $item..."
          oc patch "$item" -n "$NAMESPACE" $KUBECONFIG_FLAG --type json -p '[{"op": "remove", "path": "/metadata/finalizers"}]' 2>/dev/null || true
        fi
      fi
    done
done

# Step 2: Remove finalizers from the namespace itself (if it still exists)
# Check if namespace still exists before trying to remove its finalizers
if oc get namespace "$NAMESPACE" $KUBECONFIG_FLAG &> /dev/null; then
  # 1. Retrieve the namespace JSON.
  # 2. Use 'tr' to remove all newlines, creating a single-line JSON string.
  # 3. Use 'sed' to perform a substitution:
  #    - It finds the pattern "finalizers": [ <anything that is not a closing bracket> ]
  #    - It replaces the entire pattern with "finalizers": [] (an empty array).
  # 4. Pipe the modified JSON directly to the Kubernetes /finalize endpoint.
  echo "Removing finalizers from namespace '$NAMESPACE' itself..."
  oc get namespace "$NAMESPACE" $KUBECONFIG_FLAG -o json | \
    tr -d '\n' | \
    sed 's/"finalizers": \[[^]]*\]/"finalizers": []/' | \
    oc replace $KUBECONFIG_FLAG --raw "/api/v1/namespaces/$NAMESPACE/finalize" -f -

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
      echo ""
      echo "✅ Success: Finalizers for namespace '$NAMESPACE' have been cleared."
      echo "The Namespace should now be fully deleted. Confirm with: oc get ns"
  else
      echo ""
      echo "❌ Error: The command failed with exit code $EXIT_CODE."
      echo "Please check your oc connection and the namespace name."
  fi
else
  echo ""
  echo "✅ Success: Namespace '$NAMESPACE' was already deleted after removing resource finalizers."
  EXIT_CODE=0
fi