import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';

export const ServiceMonitorModel = {
  kind: 'ServiceMonitor',
  label: 'ServiceMonitor',
  labelKey: 'ServiceMonitor',
  labelPlural: 'ServiceMonitors',
  labelPluralKey: 'ServiceMonitors',
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
  labelKey: 'PodMonitor',
  labelPlural: 'PodMonitors',
  labelPluralKey: 'PodMonitors',
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

export const NamespaceModel: K8sModel = {
  apiVersion: 'v1',
  label: 'Namespace',
  // t('Namespace')
  labelKey: 'public~Namespace',
  plural: 'namespaces',
  abbr: 'NS',
  kind: 'Namespace',
  id: 'namespace',
  labelPlural: 'Namespaces',
  // t('Namespaces')
  labelPluralKey: 'public~Namespaces',
};

export const ProjectModel: K8sModel = {
  apiVersion: 'v1',
  apiGroup: 'project.openshift.io',
  label: 'Project',
  // t('Project')
  labelKey: 'public~Project',
  plural: 'projects',
  abbr: 'PR',
  kind: 'Project',
  id: 'project',
  labelPlural: 'Projects',
  // t('Projects')
  labelPluralKey: 'public~Projects',
};

export const StatefulSetModel = {
  namespaced: true,
  kind: 'StatefulSet',
};
