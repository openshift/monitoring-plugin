#!/bin/bash
set -eux
oc patch Scheduler cluster --type='json' -p '[{ "op": "replace", "path": "/spec/mastersSchedulable", "value": true }]'

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
#create multi-cluster
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
oc -n open-cluster-management-observability get pod
oc -n open-cluster-management-observability get svc | grep -E 'alertmanager|rbac-query'
