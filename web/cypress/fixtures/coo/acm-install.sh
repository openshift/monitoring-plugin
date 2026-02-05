#!/bin/bash
#set -eux
set -x
# This script will install ACM, MCH, MCO, and other test resources.
# The script will skip installation when MCO CR existed.

echo "[INFO] Checking for existing MultiClusterObservability CR..."
MCO_NAMESPACE="open-cluster-management-observability"
MCO_NAME="observability"
# The 'oc get ...' command will have a non-zero exit code if the resource is not found.
if oc get multiclusterobservability ${MCO_NAME} -n ${MCO_NAMESPACE} >/dev/null 2>&1; then
    echo "[INFO] MultiClusterObservability CR '${MCO_NAME}' already exists in '${MCO_NAMESPACE}'."
    echo "[INFO] Skipping installation to avoid conflicts and assuming a previous step is managing it."
    exit 0
else
    echo "[INFO] No existing MultiClusterObservability CR found. Proceeding with installation."
fi
# patch node
oc patch Scheduler cluster --type='json' -p '[{ "op": "replace", "path": "/spec/mastersSchedulable", "value": true }]'
# install acm
oc apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: open-cluster-management
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  namespace: open-cluster-management
  name: og-global
  labels:
    og_label: open-cluster-management
spec:
  targetNamespaces:
  - open-cluster-management
  upgradeStrategy: Default
EOF
oc apply -f - <<EOF
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  labels:
    operators.coreos.com/advanced-cluster-management.open-cluster-management: ""
  name: advanced-cluster-management
  namespace: open-cluster-management
spec:
  installPlanApproval: Automatic
  name: advanced-cluster-management
  source: redhat-operators
  sourceNamespace: openshift-marketplace
---
EOF
tries=30
while [[ $tries -gt 0 ]] &&
	! oc -n open-cluster-management rollout status deploy/multiclusterhub-operator; do
	sleep 10
	((tries--))
done
oc wait -n open-cluster-management --for=condition=Available deploy/multiclusterhub-operator --timeout=300s
# install mch
oc apply -f - <<EOF
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: open-cluster-management
spec: {}
EOF
sleep 5m
oc wait -n open-cluster-management --for=condition=Available deploy/search-api --timeout=300s
oc wait -n open-cluster-management --for=condition=Available deploy/search-collector --timeout=300s
oc wait -n open-cluster-management --for=condition=Available deploy/search-indexer --timeout=300s
oc -n open-cluster-management get pod
# create mco
if ! oc get ns open-cluster-management-observability >/dev/null 2>&1; then
  echo "[INFO] Creating namespace open-cluster-management-observability"
  oc create ns open-cluster-management-observability
else
  echo "[INFO] Namespace open-cluster-management-observability already exists"
fi
oc apply -f -<<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: open-cluster-management-observability
  labels:
    app.kubernetes.io/name: minio
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: minio
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app.kubernetes.io/name: minio
    spec:
      containers:
      - command:
        - /bin/sh
        - -c
        - mkdir -p /storage/thanos && /usr/bin/minio server /storage
        env:
        - name: MINIO_ACCESS_KEY
          value: minio
        - name: MINIO_SECRET_KEY
          value: minio123
        image:  quay.io/minio/minio:RELEASE.2021-08-25T00-41-18Z
        name: minio
        ports:
        - containerPort: 9000
          protocol: TCP
        volumeMounts:
        - mountPath: /storage
          name: storage
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: minio
EOF
oc apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  labels:
    app.kubernetes.io/name: minio
  name: minio
  namespace: open-cluster-management-observability
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: "1Gi"
EOF
oc apply -f - <<EOF
apiVersion: v1
stringData:
  thanos.yaml: |
    type: s3
    config:
      bucket: "thanos"
      endpoint: "minio:9000"
      insecure: true
      access_key: "minio"
      secret_key: "minio123"
kind: Secret
metadata:
  name: thanos-object-storage
  namespace: open-cluster-management-observability
type: Opaque
EOF
oc apply -f -<<EOF
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: open-cluster-management-observability
spec:
  ports:
  - port: 9000
    protocol: TCP
    targetPort: 9000
  selector:
    app.kubernetes.io/name: minio
  type: ClusterIP
EOF
oc wait -n open-cluster-management-observability --for=condition=Available deploy/minio --timeout=300s
oc apply -f - <<EOF
apiVersion: observability.open-cluster-management.io/v1beta2
kind: MultiClusterObservability
metadata:
  name: observability
spec:
  observabilityAddonSpec: {}
  storageConfig:
    metricObjectStorage:
      name: thanos-object-storage
      key: thanos.yaml 
EOF
sleep 1m
oc wait --for=condition=Ready pod -l alertmanager=observability,app=multicluster-observability-alertmanager -n open-cluster-management-observability --timeout=300s
# enable UIPlugin
oc apply -f - <<EOF
apiVersion: observability.openshift.io/v1alpha1
kind: UIPlugin
metadata:
  name: monitoring
spec:
  monitoring:
    acm:    
      enabled: true
      alertmanager:
        url: 'https://alertmanager.open-cluster-management-observability.svc:9095'
      thanosQuerier:
        url: 'https://rbac-query-proxy.open-cluster-management-observability.svc:8443'
  type: Monitoring
EOF
# apply custom-rules
oc apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: thanos-ruler-custom-rules
  namespace: open-cluster-management-observability
data:
  custom_rules.yaml: |
    groups:
      - name: alertrule-testing
        rules:
        - alert: Watchdog
          annotations:
            summary: An alert that should always be firing to certify that Alertmanager is working properly.
            description: This is an alert meant to ensure that the entire alerting pipeline is functional.
          expr: vector(1)
          labels:
            instance: "local"
            cluster: "local"
            clusterID: "111111111"
            severity: info
        - alert: Watchdog-spoke
          annotations:
            summary: An alert that should always be firing to certify that Alertmanager is working properly.
            description: This is an alert meant to ensure that the entire alerting pipeline is functional.
          expr: vector(1)
          labels:
            instance: "spoke"
            cluster: "spoke"
            clusterID: "22222222"
            severity: warn
      - name: cluster-health
        rules:
        - alert: ClusterCPUHealth-jb
          annotations:
            summary: Notify when CPU utilization on a cluster is greater than the defined utilization limit
            description: "The cluster has a high CPU usage: core for"
          expr: |
            max(cluster:cpu_usage_cores:sum) by (clusterID, cluster, prometheus) > 0
          labels:
            cluster: "{{ $labels.cluster }}"
            prometheus: "{{ $labels.prometheus }}"
            severity: critical
EOF
