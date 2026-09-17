import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'i18next';

import { getCapabilityDefinitions } from '@/features/overview/assets/capabilities-definitions';
import { COO_ID, RequirementGroupVersionKinds } from '@/features/overview/constants/const';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequiredConfig,
  RequiredConfigType,
  RequiredOperator,
  RequirementKind,
  RequirementStatus,
} from '@/features/overview/types/types';
import { getObservabilityCapability } from '@/features/overview/utils/services-utils';

export const CSV_GVK = RequirementGroupVersionKinds[RequirementKind.ClusterServiceVersion];
export const MONITORING_STACK_GVK = RequirementGroupVersionKinds[RequirementKind.MonitoringStack];

/**
 * PatternFly puts the status modifier on the Icon's inner content span, not on the
 * `pf-v6-c-icon` wrapper, so status assertions have to target `__content`.
 */
export const statusIcon = (status: 'success' | 'danger' | 'warning' | 'info') =>
  `.pf-v6-c-icon__content.pf-m-${status}`;

export const cooCSV: K8sResourceKind = {
  metadata: {
    name: 'cluster-observability-operator.v1.2.0',
    namespace: 'openshift-cluster-observability-operator',
  },
  status: { phase: 'Succeeded' },
};

export const monitoringPlugin: K8sResourceKind = {
  apiVersion: 'observability.openshift.io/v1alpha1',
  kind: 'UIPlugin',
  metadata: {
    name: 'monitoring',
    namespace: 'openshift-cluster-observability-operator',
  },
  spec: { type: 'Monitoring', monitoring: { perses: { enabled: false } } },
};

export const buildOperator = (overrides: Partial<RequiredOperator> = {}): RequiredOperator => ({
  id: COO_ID,
  title: 'Cluster Observability Operator',
  groupVersionKind: CSV_GVK,
  keywords: 'cluster observability operator',
  status: RequirementStatus.Success,
  csv: cooCSV,
  ...overrides,
});

export const buildConfig = (overrides: Partial<RequiredConfig> = {}): RequiredConfig => ({
  id: 'monitoring-stack',
  title: 'COO MonitoringStack CR',
  type: RequiredConfigType.CustomResource,
  groupVersionKind: MONITORING_STACK_GVK,
  requiredOperatorId: COO_ID,
  createNamespace: 'openshift-monitoring',
  status: RequirementStatus.Success,
  isRequiredOperatorInstalled: true,
  ...overrides,
});

const identityT = ((key: string) => key) as TFunction;

const emptyRequirementResources: Record<
  RequirementKind,
  [K8sResourceKind[] | undefined, boolean, unknown]
> = {
  [RequirementKind.ClusterServiceVersion]: [[], true, null],
  [RequirementKind.UIPlugin]: [[], true, null],
  [RequirementKind.Alertmanager]: [[], true, null],
  [RequirementKind.MonitoringStack]: [[], true, null],
  [RequirementKind.Prometheus]: [[], true, null],
  [RequirementKind.LokiStack]: [[], true, null],
  [RequirementKind.ClusterLogForwarder]: [[], true, null],
  [RequirementKind.TempoStack]: [[], true, null],
  [RequirementKind.OpenTelemetryCollector]: [[], true, null],
  [RequirementKind.FlowCollector]: [[], true, null],
};

export const buildEmptyObservabilityCapabilitiesResult = () => ({
  observabilityCapabilities: getCapabilityDefinitions(identityT).map((definition) =>
    getObservabilityCapability(definition, emptyRequirementResources),
  ),
  monitoringPlugin: undefined,
  loaded: true,
  loadError: null,
});

export const buildCapability = (
  overrides: Partial<ObservabilityCapability> = {},
): ObservabilityCapability => ({
  id: 'monitoring',
  title: 'Monitoring',
  requiredLabels: ['COO', 'MonitoringStack'],
  description: 'Collect metrics and manage alerting across cluster workloads.',
  learnMoreUrl: 'https://docs.redhat.com/monitoring-ui-plugin',
  loaded: true,
  status: CapabilityStatus.Ready,
  requiredOperators: [buildOperator()],
  requiredConfigs: [buildConfig()],
  ...overrides,
});
