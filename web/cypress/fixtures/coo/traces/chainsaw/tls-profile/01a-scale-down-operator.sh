#!/bin/bash
set -euo pipefail

# Scale down the Cluster Observability Operator before patching the plugin
# deployment. The operator owns the deployment and will reconcile away any
# manual env-var changes if left running.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tls-helpers.sh"

echo "============================================="
echo "Step 1a: Scale down observability-operator"
echo "============================================="

scale_down_operator

echo "PASS: Operator scaled down - deployment patches will not be reconciled"
