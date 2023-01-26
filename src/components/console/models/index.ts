export const ServiceMonitorModel = {
  kind: 'ServiceMonitor',
  label: 'ServiceMonitor',
  labelKey: 'public~ServiceMonitor',
  labelPlural: 'ServiceMonitors',
  labelPluralKey: 'public~ServiceMonitors',
  apiGroup: 'monitoring.coreos.com',
  apiVersion: 'v1',
  abbr: 'SM',
  namespaced: true,
  crd: true,
  plural: 'servicemonitors',
  propagationPolicy: 'Foreground',
};

export const PodMonitorModel = {
  kind: 'PodMonitor',
  label: 'PodMonitor',
  labelKey: 'public~PodMonitor',
  labelPlural: 'PodMonitors',
  labelPluralKey: 'public~PodMonitors',
  apiGroup: 'monitoring.coreos.com',
  apiVersion: 'v1',
  abbr: 'PM',
  namespaced: true,
  crd: true,
  plural: 'podmonitors',
  propagationPolicy: 'Foreground',
};

export const ServiceModel = {
  kind: 'Service',
};

export const PodModel = {
  namespaced: true,
  kind: 'Pod',
};

export const ContainerModel = {
  kind: 'Container',
};

export const DaemonSetModel = {
  namespaced: true,
  kind: 'DaemonSet',
};

export const DeploymentModel = {
  namespaced: true,
  kind: 'Deployment',
};

export const JobModel = {
  namespaced: true,
  kind: 'Job',
};

export const NodeModel = {
  kind: 'Node',
};

export const NamespaceModel = {
  kind: 'Namespace',
};

export const StatefulSetModel = {
  namespaced: true,
  kind: 'StatefulSet',
};
