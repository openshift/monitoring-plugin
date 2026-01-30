#!/bin/bash

# User variables (passed as arguments)
USER1="${USER1}"
USER2="${USER2}"

oc new-project perses-dev
oc new-project observ-test

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
  name: $USER1-perses-prometheus-api-editor
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: perses-prometheus-api-editor
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER2-perses-prometheus-api-editor
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER2
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
  name: $USER1-persesglobaldatasource-viewer
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER2-persesglobaldatasource-viewer
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER2
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesglobaldatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER1-viewer-dashboard-observ-test
  namespace: observ-test
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER1-editor-dashboard
  namespace: openshift-cluster-observability-operator
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER2-viewer-dashboard
  namespace: perses-dev
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER2
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdashboard-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER1-editor-datasource
  namespace: openshift-cluster-observability-operator
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-editor-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER1-viewer-datasource-observ-test
  namespace: observ-test
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER1
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-viewer-role
EOF

oc apply -f - <<EOF
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $USER2-viewer-datasource
  namespace: perses-dev
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: $USER2
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: persesdatasource-viewer-role
EOF