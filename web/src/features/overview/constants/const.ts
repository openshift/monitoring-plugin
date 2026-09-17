import { K8sGroupVersionKind } from '@openshift-console/dynamic-plugin-sdk';

import { RequirementKind } from '@/features/overview/types/types';

export const COO_ID = 'cluster-observability-operator';
export const COO_NAME = 'cluster-observability-operator';

export const MONITORING_CR_NAMESPACE = 'openshift-monitoring';
export const DEFAULT_CR_NAMESPACE = 'openshift-operators';

export const RequirementGroupVersionKinds: Record<RequirementKind, K8sGroupVersionKind> = {
  [RequirementKind.ClusterServiceVersion]: {
    group: 'operators.coreos.com',
    version: 'v1alpha1',
    kind: 'ClusterServiceVersion',
  },
  [RequirementKind.UIPlugin]: {
    group: 'observability.openshift.io',
    version: 'v1alpha1',
    kind: 'UIPlugin',
  },
  [RequirementKind.Alertmanager]: {
    group: 'monitoring.rhobs',
    version: 'v1',
    kind: 'Alertmanager',
  },
  [RequirementKind.MonitoringStack]: {
    group: 'monitoring.rhobs',
    version: 'v1alpha1',
    kind: 'MonitoringStack',
  },
  [RequirementKind.Prometheus]: {
    group: 'monitoring.rhobs',
    version: 'v1',
    kind: 'Prometheus',
  },
  [RequirementKind.LokiStack]: {
    group: 'loki.grafana.com',
    version: 'v1',
    kind: 'LokiStack',
  },
  [RequirementKind.ClusterLogForwarder]: {
    group: 'observability.openshift.io',
    version: 'v1',
    kind: 'ClusterLogForwarder',
  },
  [RequirementKind.TempoStack]: {
    group: 'tempo.grafana.com',
    version: 'v1alpha1',
    kind: 'TempoStack',
  },
  [RequirementKind.OpenTelemetryCollector]: {
    group: 'opentelemetry.io',
    version: 'v1beta1',
    kind: 'OpenTelemetryCollector',
  },
  [RequirementKind.FlowCollector]: {
    group: 'flows.netobserv.io',
    version: 'v1beta2',
    kind: 'FlowCollector',
  },
};

export const ClusterServiceVersionGroupVersionKind =
  RequirementGroupVersionKinds[RequirementKind.ClusterServiceVersion];

export const CSV_GROUP_VERSION_KIND =
  `${ClusterServiceVersionGroupVersionKind.group}~` +
  `${ClusterServiceVersionGroupVersionKind.version}~` +
  `${ClusterServiceVersionGroupVersionKind.kind}`;

export const UIPluginGroupVersionKind = RequirementGroupVersionKinds[RequirementKind.UIPlugin];
