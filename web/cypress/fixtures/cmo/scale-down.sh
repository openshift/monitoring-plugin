#!/bin/bash
# Set Cluster Monitoring Operator (CMO) to unmanged 
# Resource https://access.redhat.com/solutions/6548111

oc patch clusterversion version --type json -p "$(cat disable-monitoring.yaml)"

oc scale --replicas=0 -n openshift-monitoring deployment/cluster-monitoring-operator

oc scale --replicas=0 -n openshift-monitoring deployment/monitoring-plugin

# Modify the CMO deployment spec to reference your image 
# https://github.com/openshift/cluster-monitoring-operator/blob/5d1fd1bb52eeb9b2f877c45de0cf93e2f9fffb95/manifests/0000_50_cluster-monitoring-operator_05-deployment.yaml#L76

