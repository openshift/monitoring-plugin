import { TFunction } from 'i18next';

import { COO_ID, COO_NAME, MONITORING_CR_NAMESPACE } from '@/features/overview/constants/const';
import {
  CapabilityDefinition,
  RequiredConfigDefinition,
  RequiredConfigType,
  RequiredOperatorDefinition,
  RequirementKind,
} from '@/features/overview/types/types';

const csvOperator = (
  id: string,
  title: string,
  operatorName: string,
  keywords: string,
  preRequisiteOperator?: string,
): RequiredOperatorDefinition => ({
  id,
  title,
  operatorName,
  keywords,
  preRequisiteOperator,
});

const customResourceConfig = (
  id: string,
  title: string,
  groupVersionKind: RequirementKind,
  requiredOperatorId: string,
  createNamespace?: string,
): RequiredConfigDefinition => ({
  id,
  title,
  type: RequiredConfigType.CustomResource,
  groupVersionKind,
  requiredOperatorId,
  createNamespace,
});

const monitoringFeatureConfig = (
  id: string,
  title: string,
  featureName: string,
): RequiredConfigDefinition => ({
  id,
  title,
  type: RequiredConfigType.MonitoringFeature,
  featureName,
  requiredOperatorId: COO_ID,
});

const uiPluginConfig = (
  id: string,
  title: string,
  pluginName: string,
): RequiredConfigDefinition => ({
  id,
  title,
  type: RequiredConfigType.UiPlugin,
  groupVersionKind: RequirementKind.UIPlugin,
  pluginName,
  requiredOperatorId: COO_ID,
});

export const getCapabilityDefinitions = (t: TFunction): CapabilityDefinition[] => {
  const clusterObservabilityOperator: RequiredOperatorDefinition = {
    id: COO_ID,
    title: t('Cluster Observability Operator'),
    operatorName: COO_NAME,
    keywords: 'cluster observability operator',
  };

  return [
    {
      id: 'monitoring',
      title: t('Monitoring'),
      requiredLabels: [t('COO'), t('MonitoringStack')],
      description: t(
        'Collect metrics and manage alerting across cluster workloads. Available under Observe → Metrics and Observe → Alerting once configured.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/monitoring-ui-plugin',
      requiredOperators: [clusterObservabilityOperator],
      requiredConfigs: [
        customResourceConfig(
          'monitoring-stack',
          t('COO MonitoringStack CR'),
          RequirementKind.MonitoringStack,
          COO_ID,
          MONITORING_CR_NAMESPACE,
        ),
        customResourceConfig(
          'prometheus',
          t('Prometheus'),
          RequirementKind.Prometheus,
          COO_ID,
          MONITORING_CR_NAMESPACE,
        ),
        customResourceConfig(
          'alertmanager',
          t('Alertmanager'),
          RequirementKind.Alertmanager,
          COO_ID,
          MONITORING_CR_NAMESPACE,
        ),
      ],
    },
    {
      id: 'logging',
      title: t('Logging'),
      requiredLabels: [t('COO'), t('Loki'), t('CLO')],
      description: t(
        'Query application, infrastructure, and audit logs. Available under Observe → Logs once configured.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/logging-ui-plugin',
      requiredOperators: [
        clusterObservabilityOperator,
        csvOperator(
          'loki-operator',
          t('Loki Operator'),
          'loki-operator',
          'loki operator',
          COO_NAME,
        ),
        csvOperator(
          'clo-operator',
          t('CLO Operator'),
          'cluster-logging-operator',
          'cluster logging operator',
          COO_NAME,
        ),
      ],
      requiredConfigs: [
        customResourceConfig(
          'loki-stack',
          t('LokiStack CR'),
          RequirementKind.LokiStack,
          'loki-operator',
        ),
        customResourceConfig(
          'cluster-log-forwarder',
          t('ClusterLogForwarder CR'),
          RequirementKind.ClusterLogForwarder,
          'clo-operator',
          'openshift-logging',
        ),
        uiPluginConfig('logging', t('COO Logging UI Plugin CR'), 'Logging'),
      ],
    },
    {
      id: 'distributed-tracing',
      title: t('Distributed tracing'),
      requiredLabels: [t('COO'), t('Tempo'), t('OpenTelemetry')],
      description: t(
        'Analyze microservice request latency and spans using distributed traces. Available under Observe → Traces once configured.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/distributed-tracing-ui-plugin',
      requiredOperators: [
        clusterObservabilityOperator,
        csvOperator(
          'tempo-operator',
          t('Tempo Operator'),
          'tempo-operator',
          'tempo operator',
          COO_NAME,
        ),
        csvOperator(
          'otel-operator',
          t('OTEL Operator'),
          'opentelemetry-operator',
          'opentelemetry operator',
          COO_NAME,
        ),
      ],
      requiredConfigs: [
        customResourceConfig(
          'tempo-stack',
          t('TempoStack CR'),
          RequirementKind.TempoStack,
          'tempo-operator',
        ),
        customResourceConfig(
          'otel-collector',
          t('OTELCollector'),
          RequirementKind.OpenTelemetryCollector,
          'otel-operator',
        ),
        uiPluginConfig(
          'distributed-tracking',
          t('COO Distributed Tracing UI Plugin CR'),
          'DistributedTracing',
        ),
      ],
    },
    {
      id: 'dashboards',
      title: t('Dashboards'),
      requiredLabels: [t('COO'), t('Perses')],
      description: t(
        'Create and manage custom Perses dashboards. Available under Observe → Dashboards once enabled.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/perses-dashboard',
      requiredOperators: [clusterObservabilityOperator],
      requiredConfigs: [
        uiPluginConfig('monitoring-frontend', t('Monitoring frontend'), 'monitoring'),
        monitoringFeatureConfig('perses-dashboards', t('Perses Dashboards'), 'perses'),
      ],
    },
    {
      id: 'network-observability',
      title: t('Network observability'),
      requiredLabels: [t('COO'), t('NetObserv')],
      description: t(
        'Map network flows, cross-namespace traffic, and egress bottlenecks using eBPF. Available under Observe → Network Traffic once configured.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/openshift_container_platform/latest/html/network_observability/index',
      requiredOperators: [
        clusterObservabilityOperator,
        csvOperator(
          'network-observability',
          t('Network Observability Operator'),
          'network-observability-operator',
          'network observability',
        ),
      ],
      requiredConfigs: [
        customResourceConfig(
          'flow-collector',
          t('FlowCollector CR'),
          RequirementKind.FlowCollector,
          'network-observability',
        ),
      ],
    },
    {
      id: 'signal-correlation',
      isAdvanced: true,
      title: t('Signal correlation'),
      requiredLabels: [t('COO'), t('Korrel8r')],
      description: t(
        'Correlate metrics, logs, traces, and alerts across workloads. Available from the global header once enabled.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/troubleshooting-ui-plugin',
      requiredOperators: [clusterObservabilityOperator],
      requiredConfigs: [
        uiPluginConfig(
          'troubleshooting-panel',
          t('COO Troubleshooting Panel UI Plugin CR'),
          'TroubleshootingPanel',
        ),
      ],
    },
    {
      id: 'incident-detection',
      isAdvanced: true,
      title: t('Incident detection'),
      requiredLabels: [t('COO'), t('Health Analyzer')],
      description: t(
        'Group alerts into actionable incidents to reduce noise. Available under Observe → Alerts → Incidents once enabled.',
      ),
      learnMoreUrl:
        'https://docs.redhat.com/en/documentation/red_hat_openshift_cluster_observability_operator/1-latest/html/ui_plugins_for_red_hat_openshift_cluster_observability_operator/monitoring-ui-plugin#coo-incident-detection-overview_monitoring-ui-plugin',
      requiredOperators: [clusterObservabilityOperator],
      requiredConfigs: [
        monitoringFeatureConfig(
          'monitoring-ui-plugin',
          t('COO Monitoring UI Plugin CR (Health Analyzer feature)'),
          'clusterHealthAnalyzer',
        ),
      ],
    },
  ];
};
