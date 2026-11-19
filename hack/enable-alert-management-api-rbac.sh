#!/usr/bin/env bash
set -euo pipefail

# Development helper: run with credentials allowed to create and bind RBAC roles.
# Keep these additional permissions separate from the operator-managed RBAC.
echo "Applying alert-management-api permissions for openshift-monitoring/monitoring-plugin..."
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-plugin-alert-management-api
rules:
  # The PrometheusRule informer lists and watches across all namespaces.
  - apiGroups: ["monitoring.coreos.com"]
    resources: ["prometheusrules"]
    verbs: ["get", "list", "watch"]
  # Namespaces are cluster-scoped resources.
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-plugin-alert-management-api
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: monitoring-plugin-alert-management-api
subjects:
  - kind: ServiceAccount
    name: monitoring-plugin
    namespace: openshift-monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: monitoring-plugin-alert-management-api
  namespace: openshift-monitoring
rules:
  # The AlertRelabelConfig and AlertingRule informers are scoped to openshift-monitoring.
  - apiGroups: ["monitoring.openshift.io"]
    resources: ["alertrelabelconfigs", "alertingrules"]
    verbs: ["get", "list", "watch"]
  # The ConfigMap informer filters by metadata.name, allowing a name-scoped rule.
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["cluster-monitoring-config"]
    verbs: ["get", "list", "watch"]
  # Route discovery uses the service account, even for requests made by kubeadmin.
  - apiGroups: ["route.openshift.io"]
    resources: ["routes"]
    resourceNames: ["prometheus-k8s", "alertmanager-main"]
    verbs: ["get"]
  # The Secret informer also filters by metadata.name; do not expose other secrets.
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["alert-relabel-configs"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: monitoring-plugin-alert-management-api
  namespace: openshift-monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: monitoring-plugin-alert-management-api
subjects:
  - kind: ServiceAccount
    name: monitoring-plugin
    namespace: openshift-monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: monitoring-plugin-alert-management-api
  namespace: openshift-user-workload-monitoring
rules:
  # Allow discovery, including checking for absent user workload Routes.
  - apiGroups: ["route.openshift.io"]
    resources: ["routes"]
    resourceNames: ["prometheus-user-workload", "alertmanager-user-workload"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: monitoring-plugin-alert-management-api
  namespace: openshift-user-workload-monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: monitoring-plugin-alert-management-api
subjects:
  - kind: ServiceAccount
    name: monitoring-plugin
    namespace: openshift-monitoring
EOF
