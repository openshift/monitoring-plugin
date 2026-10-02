#!/bin/bash
# Perses RBAC test groups — permissions summary
# (mirrors rbac_perses_e2e_ci_users.sh, but granted via group membership
# instead of direct user bindings)
#
# | Group  | Cluster-wide ClusterRoleBindings                                 | Namespace                                | Built-in Role | Perses Dashboard Role       | Perses Datasource Role       |
# |--------|------------------------------------------------------------------|------------------------------------------|---------------|-----------------------------|------------------------------|
# | group1 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | observ-test                              | view          | persesdashboard-viewer-role | persesdatasource-viewer-role |
# |        |                                                                  | openshift-cluster-observability-operator | view          | persesdashboard-editor-role | persesdatasource-editor-role |
# |        |                                                                  | openshift-monitoring                     | view          | -                           | -                            |
# | group2 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | perses-dev                               | view          | persesdashboard-viewer-role | persesdatasource-viewer-role |
# |        |                                                                  | openshift-monitoring                     | view          | -                           | -                            |
# | group3 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | empty-namespace3                         | view          | persesdashboard-editor-role | persesdatasource-editor-role |
# |        |                                                                  | openshift-monitoring                     | view          | -                           | -                            |
# | group4 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | empty-namespace4                         | view          | persesdashboard-viewer-role | persesdatasource-viewer-role |
# |        |                                                                  | openshift-monitoring                     | view          | -                           | -                            |
# | group5 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | openshift-monitoring                     | admin         | -                           | -                            |
# | group6 | perses-prometheus-api-editor, persesglobaldatasource-viewer-role | -                                        | -             | -                           | -                            |
 
set -euo pipefail

# User variables (passed as arguments)
USER1="${USER1}"
USER2="${USER2}"
USER3="${USER3}"
USER4="${USER4}"
USER5="${USER5}"
USER6="${USER6}"

oc create namespace perses-dev 2>/dev/null || true
oc create namespace observ-test 2>/dev/null || true 
oc create namespace empty-namespace3 2>/dev/null || true
oc create namespace empty-namespace4 2>/dev/null || true

# Group variables: one group per user, each granted the same RBAC the
# corresponding user gets in rbac_perses_e2e_ci_users.sh, but via group membership
# instead of a direct user binding.
GROUP1="perses-e2e-group1"
GROUP2="perses-e2e-group2"
GROUP3="perses-e2e-group3"
GROUP4="perses-e2e-group4"
GROUP5="perses-e2e-group5"
GROUP6="perses-e2e-group6"

oc adm groups new "${GROUP1}" 2>/dev/null || true
oc adm groups new "${GROUP2}" 2>/dev/null || true
oc adm groups new "${GROUP3}" 2>/dev/null || true
oc adm groups new "${GROUP4}" 2>/dev/null || true
oc adm groups new "${GROUP5}" 2>/dev/null || true
oc adm groups new "${GROUP6}" 2>/dev/null || true

oc adm groups add-users "${GROUP1}" "${USER1}"
oc adm groups add-users "${GROUP2}" "${USER2}"
oc adm groups add-users "${GROUP3}" "${USER3}"
oc adm groups add-users "${GROUP4}" "${USER4}"
oc adm groups add-users "${GROUP5}" "${USER5}"
oc adm groups add-users "${GROUP6}" "${USER6}"

oc apply -f - <<EOF
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: user-reader
rules:
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - autoscaling.openshift.io
    resources:
      - '*'
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - machine.openshift.io
    resources:
      - machinehealthchecks
      - machines
      - machinesets
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - k8s.ovn.org
    resources:
      - egressfirewalls
      - egressips
      - egressqoses
      - egressservices
      - adminpolicybasedexternalroutes
      - userdefinednetworks
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - policy.networking.k8s.io
    resources:
      - adminnetworkpolicies
      - baselineadminnetworkpolicies
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - config.openshift.io
    resources:
      - operatorhubs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - metrics.k8s.io
    resources:
      - pods
      - nodes
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
    resources:
      - componentstatuses
      - nodes
      - nodes/status
      - persistentvolumeclaims/status
      - persistentvolumes
      - persistentvolumes/status
      - pods/binding
      - pods/eviction
      - podtemplates
      - securitycontextconstraints
      - services/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - admissionregistration.k8s.io
    resources:
      - mutatingwebhookconfigurations
      - validatingwebhookconfigurations
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - apps
    resources:
      - controllerrevisions
      - daemonsets/status
      - deployments/status
      - replicasets/status
      - statefulsets/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
      - customresourcedefinitions/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - apiregistration.k8s.io
    resources:
      - apiservices
      - apiservices/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - autoscaling
    resources:
      - horizontalpodautoscalers/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - batch
    resources:
      - cronjobs/status
      - jobs/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - coordination.k8s.io
    resources:
      - leases
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - events.k8s.io
    resources:
      - events
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - networking.k8s.io
    resources:
      - ingresses/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - node.k8s.io
    resources:
      - runtimeclasses
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - policy
    resources:
      - poddisruptionbudgets/status
      - podsecuritypolicies
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - rbac.authorization.k8s.io
    resources:
      - clusterrolebindings
      - clusterroles
      - rolebindings
      - roles
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - storage.k8s.io
    resources:
      - csidrivers
      - csinodes
      - storageclasses
      - volumeattachments
      - volumeattachments/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - scheduling.k8s.io
    resources:
      - priorityclasses
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - certificates.k8s.io
    resources:
      - certificatesigningrequests
      - certificatesigningrequests/approval
      - certificatesigningrequests/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - authorization.openshift.io
    resources:
      - clusterrolebindings
      - clusterroles
      - rolebindingrestrictions
      - rolebindings
      - roles
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - build.openshift.io
    resources:
      - builds/details
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - image.openshift.io
    resources:
      - images
      - imagesignatures
  - verbs:
      - get
    apiGroups:
      - ''
      - image.openshift.io
    resources:
      - imagestreams/layers
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - oauth.openshift.io
    resources:
      - oauthclientauthorizations
  - verbs:
      - list
      - watch
    apiGroups:
      - ''
      - project.openshift.io
    resources:
      - projects
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - project.openshift.io
    resources:
      - projectrequests
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - quota.openshift.io
    resources:
      - clusterresourcequotas
      - clusterresourcequotas/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - network.openshift.io
    resources:
      - clusternetworks
      - egressnetworkpolicies
      - hostsubnets
      - netnamespaces
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - security.openshift.io
    resources:
      - securitycontextconstraints
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - security.openshift.io
    resources:
      - rangeallocations
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - template.openshift.io
    resources:
      - brokertemplateinstances
      - templateinstances/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - user.openshift.io
    resources:
      - groups
      - identities
      - useridentitymappings
      - users
  - verbs:
      - create
    apiGroups:
      - ''
      - authorization.openshift.io
    resources:
      - localresourceaccessreviews
      - localsubjectaccessreviews
      - resourceaccessreviews
      - selfsubjectrulesreviews
      - subjectaccessreviews
      - subjectrulesreviews
  - verbs:
      - create
    apiGroups:
      - authorization.k8s.io
    resources:
      - localsubjectaccessreviews
      - selfsubjectaccessreviews
      - selfsubjectrulesreviews
      - subjectaccessreviews
  - verbs:
      - create
    apiGroups:
      - authentication.k8s.io
    resources:
      - tokenreviews
  - verbs:
      - create
    apiGroups:
      - ''
      - security.openshift.io
    resources:
      - podsecuritypolicyreviews
      - podsecuritypolicyselfsubjectreviews
      - podsecuritypolicysubjectreviews
  - verbs:
      - get
    apiGroups:
      - ''
    resources:
      - nodes/metrics
      - nodes/spec
  - verbs:
      - create
      - get
    apiGroups:
      - ''
    resources:
      - nodes/stats
  - verbs:
      - get
    nonResourceURLs:
      - '*'
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - cloudcredential.openshift.io
    resources:
      - credentialsrequests
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - config.openshift.io
    resources:
      - apiservers
      - authentications
      - builds
      - clusteroperators
      - clusterversions
      - consoles
      - dnses
      - featuregates
      - images
      - infrastructures
      - ingresses
      - networks
      - oauths
      - projects
      - proxies
      - schedulers
      - nodes
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - samples.operator.openshift.io
    resources:
      - configs
      - configs/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - authentication.k8s.io
    resources:
      - tokenreviews
      - subjectaccessreviews
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - authorization.k8s.io
    resources:
      - subjectaccessreviews
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - machineconfiguration.openshift.io
    resources:
      - containerruntimeconfigs
      - controllerconfigs
      - kubeletconfigs
      - machineconfigpools
      - machineconfignodes
      - machineconfignodes/status
      - machineosconfigs
      - machineosconfigs/status
      - machineosbuilds
      - machineosbuilds/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - config.openshift.io
    resources:
      - images
      - clusterversions
      - featuregates
      - nodes
      - nodes/status
      - apiservers
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - operators.coreos.com
    resources:
      - clusterserviceversions
      - catalogsources
      - installplans
      - subscriptions
      - operatorgroups
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - packages.operators.coreos.com
    resources:
      - packagemanifests
      - packagemanifests/icon
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - alertmanagerconfigs.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - alertmanagerconfigs
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - alertmanagers.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - alertmanagers
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - monitoringstacks.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - monitoringstacks
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - k8s.ovn.org
    resources:
      - userdefinednetworks
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - packages.operators.coreos.com
    resources:
      - packagemanifests
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - podmonitors.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - podmonitors
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - probes.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - probes
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - prometheusagents.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - prometheusagents
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - prometheuses.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - prometheuses
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - prometheusrules.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - prometheusrules
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - image.openshift.io
    resources:
      - imagestreamimages
      - imagestreammappings
      - imagestreams
      - imagestreamtags
      - imagetags
  - verbs:
      - get
    apiGroups:
      - ''
    resources:
      - namespaces
  - verbs:
      - get
    apiGroups:
      - ''
      - project.openshift.io
    resources:
      - projects
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - scrapeconfigs.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - scrapeconfigs
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - servicemonitors.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - servicemonitors
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
    resources:
      - configmaps
      - endpoints
      - persistentvolumeclaims
      - persistentvolumeclaims/status
      - pods
      - replicationcontrollers
      - replicationcontrollers/scale
      - serviceaccounts
      - services
      - services/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
    resources:
      - bindings
      - events
      - limitranges
      - namespaces/status
      - pods/log
      - pods/status
      - replicationcontrollers/status
      - resourcequotas
      - resourcequotas/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
    resources:
      - namespaces
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - discovery.k8s.io
    resources:
      - endpointslices
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - apps
    resources:
      - controllerrevisions
      - daemonsets
      - daemonsets/status
      - deployments
      - deployments/scale
      - deployments/status
      - replicasets
      - replicasets/scale
      - replicasets/status
      - statefulsets
      - statefulsets/scale
      - statefulsets/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - autoscaling
    resources:
      - horizontalpodautoscalers
      - horizontalpodautoscalers/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - batch
    resources:
      - cronjobs
      - cronjobs/status
      - jobs
      - jobs/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - extensions
    resources:
      - daemonsets
      - daemonsets/status
      - deployments
      - deployments/scale
      - deployments/status
      - ingresses
      - ingresses/status
      - networkpolicies
      - replicasets
      - replicasets/scale
      - replicasets/status
      - replicationcontrollers/scale
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - policy
    resources:
      - poddisruptionbudgets
      - poddisruptionbudgets/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - networking.k8s.io
    resources:
      - ingresses
      - ingresses/status
      - networkpolicies
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - snapshot.storage.k8s.io
    resources:
      - volumesnapshots
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - build.openshift.io
    resources:
      - buildconfigs
      - buildconfigs/webhooks
      - builds
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - build.openshift.io
    resources:
      - builds/log
  - verbs:
      - view
    apiGroups:
      - build.openshift.io
    resources:
      - jenkins
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - apps.openshift.io
    resources:
      - deploymentconfigs
      - deploymentconfigs/scale
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - apps.openshift.io
    resources:
      - deploymentconfigs/log
      - deploymentconfigs/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - image.openshift.io
    resources:
      - imagestreams/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - quota.openshift.io
    resources:
      - appliedclusterresourcequotas
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - route.openshift.io
    resources:
      - routes
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - route.openshift.io
    resources:
      - routes/status
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - template.openshift.io
    resources:
      - processedtemplates
      - templateconfigs
      - templateinstances
      - templates
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
      - build.openshift.io
    resources:
      - buildlogs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - ''
    resources:
      - resourcequotausages
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - thanosqueriers.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - thanosqueriers
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - thanosrulers.monitoring.rhobs
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.rhobs
    resources:
      - thanosrulers
  - verbs:
      - get
    apiGroups:
      - apiextensions.k8s.io
    resources:
      - customresourcedefinitions
    resourceNames:
      - uiplugins.observability.openshift.io
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - observability.openshift.io
    resources:
      - uiplugins
  - verbs:
      - get
      - list
      - watch
    apiGroups:
      - monitoring.coreos.com
    resources:
      - prometheuses/api
EOF

oc apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: perses-prometheus-api-editor
rules:
- apiGroups:
  - "monitoring.coreos.com"
  resources:
  - "prometheuses/api"
  verbs:
  - "get"
  - "list"
  - "watch"
  - "create"
  - "update"
EOF


oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group2-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP2}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group3-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP3}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group4-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP4}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group5-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP5}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group6-perses-prometheus-api-editor
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP6}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

#Perses ClusterRoleBindings
oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group2-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP2}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group3-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP3}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group4-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP4}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group5-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP5}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group6-persesglobaldatasource-viewer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP6}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc -n observ-test policy add-role-to-group view "${GROUP1}"
oc -n openshift-cluster-observability-operator policy add-role-to-group view "${GROUP1}"
oc -n perses-dev policy add-role-to-group view "${GROUP2}"
oc -n empty-namespace3 policy add-role-to-group view "${GROUP3}"
oc -n empty-namespace4 policy add-role-to-group view "${GROUP4}"

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-viewer-dashboard-observ-test
  namespace: observ-test
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-editor-dashboard
  namespace: openshift-cluster-observability-operator
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group2-viewer-dashboard
  namespace: perses-dev
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP2}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group3-editor-dashboard
  namespace: empty-namespace3
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP3}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group4-viewer-dashboard
  namespace: empty-namespace4
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP4}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-editor-datasource
  namespace: openshift-cluster-observability-operator
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group1-viewer-datasource
  namespace: observ-test
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP1}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group2-viewer-datasource
  namespace: perses-dev
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP2}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group3-editor-datasource
  namespace: empty-namespace3
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP3}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: group4-viewer-datasource
  namespace: empty-namespace4
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${GROUP4}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-viewer-role
EOF

oc -n openshift-monitoring policy add-role-to-group view "${GROUP1}"
oc -n openshift-monitoring policy add-role-to-group view "${GROUP2}"
oc -n openshift-monitoring policy add-role-to-group view "${GROUP3}"
oc -n openshift-monitoring policy add-role-to-group view "${GROUP4}"
oc -n openshift-monitoring policy add-role-to-group admin "${GROUP5}"

# ---------------------------------------------------------------------------
# Remove the direct-to-user RBAC grants created by rbac_perses_e2e_ci_users.sh
# now that USER1..USER6 get the same permissions through GROUP1..GROUP6
# above. This leaves each user with permissions granted exclusively via
# their group, with nothing bound directly to the user.
# ---------------------------------------------------------------------------

# ClusterRoleBindings bound directly to each user
oc delete clusterrolebinding user1-perses-prometheus-api-editor --ignore-not-found
oc delete clusterrolebinding user2-perses-prometheus-api-editor --ignore-not-found
oc delete clusterrolebinding user3-perses-prometheus-api-editor --ignore-not-found
oc delete clusterrolebinding user4-perses-prometheus-api-editor --ignore-not-found
oc delete clusterrolebinding user5-perses-prometheus-api-editor --ignore-not-found
oc delete clusterrolebinding user6-perses-prometheus-api-editor --ignore-not-found

oc delete clusterrolebinding user1-persesglobaldatasource-viewer --ignore-not-found
oc delete clusterrolebinding user2-persesglobaldatasource-viewer --ignore-not-found
oc delete clusterrolebinding user3-persesglobaldatasource-viewer --ignore-not-found
oc delete clusterrolebinding user4-persesglobaldatasource-viewer --ignore-not-found
oc delete clusterrolebinding user5-persesglobaldatasource-viewer --ignore-not-found
oc delete clusterrolebinding user6-persesglobaldatasource-viewer --ignore-not-found

# RoleBindings bound directly to each user
oc -n observ-test delete rolebinding user1-viewer-dashboard-observ-test --ignore-not-found
oc -n openshift-cluster-observability-operator delete rolebinding user1-editor-dashboard --ignore-not-found
oc -n perses-dev delete rolebinding user2-viewer-dashboard --ignore-not-found
oc -n empty-namespace3 delete rolebinding user3-editor-dashboard --ignore-not-found
oc -n empty-namespace4 delete rolebinding user4-viewer-dashboard --ignore-not-found
oc -n openshift-cluster-observability-operator delete rolebinding user1-editor-datasource --ignore-not-found
oc -n observ-test delete rolebinding user1-viewer-datasource --ignore-not-found
oc -n perses-dev delete rolebinding user2-viewer-datasource --ignore-not-found
oc -n empty-namespace3 delete rolebinding user3-editor-datasource --ignore-not-found
oc -n empty-namespace4 delete rolebinding user4-viewer-datasource --ignore-not-found

# Policy-based grants (oc policy add-role-to-user) bound directly to each user.
# `|| true` makes this tolerant of rbac_perses_e2e_ci_users.sh never having
# run (so the user was never actually a subject on these RoleBindings) -
# oc adm policy remove-role-from-user exits non-zero with
# "unable to find target" when there's nothing to remove, which is the
# desired end state, not a real failure.
oc -n observ-test policy remove-role-from-user view "${USER1}" || true
oc -n openshift-cluster-observability-operator policy remove-role-from-user view "${USER1}" || true
oc -n perses-dev policy remove-role-from-user view "${USER2}" || true
oc -n empty-namespace3 policy remove-role-from-user view "${USER3}" || true
oc -n empty-namespace4 policy remove-role-from-user view "${USER4}" || true

oc -n openshift-monitoring policy remove-role-from-user view "${USER1}" || true
oc -n openshift-monitoring policy remove-role-from-user view "${USER2}" || true
oc -n openshift-monitoring policy remove-role-from-user view "${USER3}" || true
oc -n openshift-monitoring policy remove-role-from-user view "${USER4}" || true
oc -n openshift-monitoring policy remove-role-from-user admin "${USER5}" || true