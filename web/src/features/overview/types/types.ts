import { K8sGroupVersionKind, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

export enum RequirementKind {
  ClusterServiceVersion = 'ClusterServiceVersion',
  UIPlugin = 'UIPlugin',
  Alertmanager = 'Alertmanager',
  MonitoringStack = 'MonitoringStack',
  Prometheus = 'Prometheus',
  LokiStack = 'LokiStack',
  ClusterLogForwarder = 'ClusterLogForwarder',
  TempoStack = 'TempoStack',
  OpenTelemetryCollector = 'OpenTelemetryCollector',
  FlowCollector = 'FlowCollector',
}

export enum RequirementStatus {
  Success,
  Degraded,
  Missing,
}

export type RequiredOperator = {
  id: string;
  title: string;
  groupVersionKind: K8sGroupVersionKind;
  keywords?: string;
  status: RequirementStatus;
  message?: string;
  csv?: K8sResourceKind;
  missingPrerequisite?: boolean;
};

export enum RequiredConfigType {
  CustomResource,
  UiPlugin,
  MonitoringFeature,
}

export type RequiredConfig = {
  id: string;
  title: string;
  type: RequiredConfigType;
  groupVersionKind?: K8sGroupVersionKind;
  pluginName?: string;
  featureName?: string;
  requiredOperatorId?: string;
  /** Catalog default when CSV examples and existing instances do not specify a namespace. */
  createNamespace?: string;
  /** When true, links to a cluster-scoped ~new form instead of a namespaced one. */
  clusterScoped?: boolean;
  status?: RequirementStatus;
  isRequiredOperatorInstalled?: boolean;
};

export enum CapabilityStatus {
  Available,
  Partial,
  Ready,
}

export type ObservabilityCapability = {
  id: string;
  isAdvanced?: boolean;
  title: string;
  requiredLabels?: string[];
  description: string;
  learnMoreUrl?: string;
  loaded: boolean;
  status: CapabilityStatus;
  requiredOperators: RequiredOperator[];
  requiredConfigs: RequiredConfig[];
};

export type RequiredOperatorDefinition = {
  id: string;
  title: string;
  operatorName: string;
  keywords: string;
  preRequisiteOperator?: string;
};

export type RequiredConfigDefinition = {
  id: string;
  title: string;
  type: RequiredConfigType;
  groupVersionKind?: RequirementKind;
  pluginName?: string;
  requiredOperatorId?: string;
  featureName?: string;
  createNamespace?: string;
  clusterScoped?: boolean;
};

export type CapabilityDefinition = {
  id: string;
  isAdvanced?: boolean;
  title: string;
  requiredLabels?: string[];
  description: string;
  learnMoreUrl?: string;
  requiredOperators: RequiredOperatorDefinition[];
  requiredConfigs: RequiredConfigDefinition[];
};
