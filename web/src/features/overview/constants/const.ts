import { K8sGroupVersionKind } from '@openshift-console/dynamic-plugin-sdk';

import { RequirementGroupVersionKind } from '@/features/overview/types/types';

export const COO_ID = 'cluster-observability-operator';
export const COO_NAME = 'cluster-observability-operator';

export const MONITORING_CR_NAMESPACE = 'openshift-monitoring';
export const DEFAULT_CR_NAMESPACE = 'openshift-operators';

export const RequirementGroupVersionKinds: Record<
  RequirementGroupVersionKind,
  K8sGroupVersionKind
> = {
  [RequirementGroupVersionKind.ClusterServiceVersion]: {
    group: 'operators.coreos.com',
    version: 'v1alpha1',
    kind: 'ClusterServiceVersion',
  },
  [RequirementGroupVersionKind.UIPlugin]: {
    group: 'observability.openshift.io',
    version: 'v1alpha1',
    kind: 'UIPlugin',
  },
  [RequirementGroupVersionKind.Alertmanager]: {
    group: 'monitoring.rhobs',
    version: 'v1',
    kind: 'Alertmanager',
  },
  [RequirementGroupVersionKind.MonitoringStack]: {
    group: 'monitoring.rhobs',
    version: 'v1alpha1',
    kind: 'MonitoringStack',
  },
  [RequirementGroupVersionKind.Prometheus]: {
    group: 'monitoring.rhobs',
    version: 'v1',
    kind: 'Prometheus',
  },
  [RequirementGroupVersionKind.LokiStack]: {
    group: 'loki.grafana.com',
    version: 'v1',
    kind: 'LokiStack',
  },
  [RequirementGroupVersionKind.ClusterLogForwarder]: {
    group: 'observability.openshift.io',
    version: 'v1',
    kind: 'ClusterLogForwarder',
  },
  [RequirementGroupVersionKind.TempoStack]: {
    group: 'tempo.grafana.com',
    version: 'v1alpha1',
    kind: 'TempoStack',
  },
  [RequirementGroupVersionKind.OpenTelemetryCollector]: {
    group: 'opentelemetry.io',
    version: 'v1beta1',
    kind: 'OpenTelemetryCollector',
  },
  [RequirementGroupVersionKind.FlowCollector]: {
    group: 'flows.netobserv.io',
    version: 'v1beta2',
    kind: 'FlowCollector',
  },
};

export const ClusterServiceVersionGroupVersionKind =
  RequirementGroupVersionKinds[RequirementGroupVersionKind.ClusterServiceVersion];

export const CSV_GROUP_VERSION_KIND =
  `${ClusterServiceVersionGroupVersionKind.group}~` +
  `${ClusterServiceVersionGroupVersionKind.version}~` +
  `${ClusterServiceVersionGroupVersionKind.kind}`;

export const UIPluginGroupVersionKind =
  RequirementGroupVersionKinds[RequirementGroupVersionKind.UIPlugin];
