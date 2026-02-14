#!/bin/bash
echo COO install through FBC

COO_NAMESPACE="${CYPRESS_COO_NAMESPACE:-openshift-cluster-observability-operator}"

oc apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  labels:
    openshift.io/cluster-monitoring: "true"
  name: ${COO_NAMESPACE}
EOF

oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  namespace: ${COO_NAMESPACE}
  name: og-global
  labels:
    og_label: ${COO_NAMESPACE}
spec:
  upgradeStrategy: Default
EOF


oc apply -f - <<EOF
---
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  annotations:
  name: observability-operator
  namespace: openshift-marketplace
spec:
  displayName: coo-fbc
  icon:
    base64data: ""
    mediatype: ""
  image: "${FBC_STAGE_COO_IMAGE}"
  sourceType: grpc
  grpcPodConfig:
    securityContextConfig: restricted
  updateStrategy:
    registryPoll:
      interval: 1m0s
EOF

oc apply -f - <<EOF
apiVersion: config.openshift.io/v1
kind: ImageDigestMirrorSet
metadata:
  name: idms-coo
spec:
  imageDigestMirrors:
  - mirrors:
    - registry.stage.redhat.io
    source: registry.redhat.io
EOF

oc apply -f - <<EOF
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  labels:
    operators.coreos.com/observability-operator.openshift-operators: ""
  name: cluster-observability-operator
  namespace: ${COO_NAMESPACE}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: cluster-observability-operator
  source: observability-operator
  sourceNamespace: openshift-marketplace
EOF