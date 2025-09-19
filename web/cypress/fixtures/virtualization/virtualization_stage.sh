#!/bin/bash
echo COO install through FBC

oc apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: openshift-cnv
EOF

oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: openshift-virtualization-group
  namespace: openshift-cnv
spec:
  targetNamespaces:
  - openshift-cnv
EOF


# oc apply -f - <<EOF
# ---
# apiVersion: operators.coreos.com/v1alpha1
# kind: CatalogSource
# metadata:
#   annotations:
#   name: observability-operator
#   namespace: openshift-marketplace
# spec:
#   displayName: coo-fbc
#   icon:
#     base64data: ""
#     mediatype: ""
#   image: "${FBC_STAGE_COO_IMAGE}"
#   sourceType: grpc
#   grpcPodConfig:
#     securityContextConfig: restricted
#   updateStrategy:
#     registryPoll:
#       interval: 1m0s
# EOF

# oc apply -f - <<EOF
# apiVersion: config.openshift.io/v1
# kind: ImageDigestMirrorSet
# metadata:
#   name: idms-coo
# spec:
#   imageDigestMirrors:
#   - mirrors:
#     - registry.stage.redhat.io
#     source: registry.redhat.io
# EOF

oc apply -f - <<EOF
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: kubevirt-hyperconverged
  namespace: openshift-cnv
spec:
  channel: stable
  installPlanApproval: Automatic
  name: kubevirt-hyperconverged
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
