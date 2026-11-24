import { PrometheusRulesResponse, Silence } from '@openshift-console/dynamic-plugin-sdk';

import rulesResponse from '@/features/alert-management-api/tests/fixtures/rules.json';
import silencesResponse from '@/features/alert-management-api/tests/fixtures/silences.json';
import {
  GetAlertsResponse,
  GetRulesResponse,
} from '@/shared/clients/alert-management-api/generated/api';

const mockTime = Date.now();
const minutesAgo = (minutes: number) => new Date(mockTime - minutes * 60_000).toISOString();

const alertNames = [
  'WorkloadCPUHigh',
  'WorkloadMemoryHigh',
  'WorkloadDiskPressure',
  'WorkloadPodRestarts',
  'WorkloadQuotaNearLimit',
  'WorkloadRequestLatency',
  'WorkloadErrorRate',
  'WorkloadReplicaShortage',
  'WorkloadIngressFailures',
  'WorkloadQueueBacklog',
  'WorkloadCertificateExpiry',
  'WorkloadNetworkDrops',
  'WorkloadStorageLatency',
  'WorkloadJobFailures',
  'WorkloadContainerOOM',
  'WorkloadAPITimeouts',
  'WorkloadUnavailable',
  'WorkloadVolumeFull',
];
const severities = ['critical', 'warning', 'info'] as const;
const namespaces = ['production', 'payments', 'logging', 'analytics'];
const components = ['Compute', 'Networking', 'Storage', 'Workload'];

const namespaceRules = {
  file: 'alert-management-api-mock',
  name: 'user-workload-alerts',
  rules: [
    {
      alerts: [
        {
          activeAt: minutesAgo(12),
          annotations: { summary: 'The checkout service is unavailable.' },
          labels: {
            alertname: 'ServiceUnavailable',
            namespace: 'production',
            severity: 'critical',
          },
          state: 'firing',
          value: '1',
        },
      ],
      annotations: {},
      duration: 0,
      labels: { prometheus: 'openshift-user-workload-monitoring', severity: 'critical' },
      name: 'ServiceUnavailable',
      query: 'up == 0',
      type: 'alerting',
    },
    {
      alerts: [
        {
          activeAt: minutesAgo(8),
          annotations: { summary: 'The payments service has high latency.' },
          labels: {
            alertname: 'HighRequestLatency',
            namespace: 'payments',
            severity: 'warning',
          },
          state: 'firing',
          value: '1',
        },
      ],
      annotations: {},
      duration: 0,
      labels: { prometheus: 'openshift-user-workload-monitoring', severity: 'warning' },
      name: 'HighRequestLatency',
      query: 'histogram_quantile(0.99, http_request_duration_seconds_bucket) > 1',
      type: 'alerting',
    },
    ...alertNames.map((name, index) => {
      const severity = severities[index % severities.length];
      return {
        alerts: [
          {
            activeAt: minutesAgo(index * 40 + 3),
            annotations: { summary: `${name} is firing.` },
            labels: {
              alertname: name,
              namespace: namespaces[index % namespaces.length],
              severity,
              pod: `workload-${index + 1}`,
            },
            state: 'firing',
            value: '1',
          },
        ],
        annotations: {},
        duration: 0,
        labels: { prometheus: 'openshift-user-workload-monitoring', severity },
        name,
        query: `vector(${index + 1})`,
        type: 'alerting',
      };
    }),
    {
      alerts: Array.from({ length: 6 }, (_, index) => ({
        activeAt: minutesAgo(index + 1),
        annotations: { summary: 'Requests to the API are slow.' },
        labels: {
          alertname: 'RepeatedRequestLatency',
          namespace: 'production',
          severity: 'warning',
          pod: `api-${index + 1}`,
        },
        state: 'firing',
        value: '1',
      })),
      annotations: {},
      duration: 0,
      labels: { prometheus: 'openshift-user-workload-monitoring', severity: 'warning' },
      name: 'RepeatedRequestLatency',
      query: 'histogram_quantile(0.99, api_request_duration_seconds_bucket) > 1',
      type: 'alerting',
    },
  ],
};

export const getMockRulesResponse = (): PrometheusRulesResponse => {
  const response = structuredClone(rulesResponse) as PrometheusRulesResponse;
  response.data.groups.push(structuredClone(namespaceRules) as never);
  response.data.groups.forEach((group, groupIndex) => {
    group.rules.forEach((rule, ruleIndex) => {
      const component = components[(groupIndex + ruleIndex) % components.length];
      rule.alerts?.forEach((alert, alertIndex) => {
        const resourceIndex = Math.floor(ruleIndex / 8) + Math.floor(alertIndex / 3) + 1;
        alert.labels.component = component;
        alert.labels.resource = `${component.toLowerCase()}-${resourceIndex}`;
      });
    });
  });
  return response;
};

export const getMockManagementRulesResponse = (): GetRulesResponse => ({
  data: {
    groups: getMockRulesResponse().data.groups.map((group, groupIndex) => ({
      ...group,
      interval: 30,
      limit: 0,
      evaluationTime: 0,
      lastEvaluation: new Date(mockTime).toISOString(),
      rules: group.rules.map((rule, ruleIndex) => ({
        ...rule,
        type: 'alerting',
        alerts: rule.alerts.map((alert) => ({ ...alert, value: String(alert.value ?? '') })),
        keepFiringFor: 0,
        health: 'ok',
        evaluationTime: 0,
        lastEvaluation: new Date(mockTime).toISOString(),
        labels: {
          ...rule.labels,
          openshift_io_alert_rule_id: `mock-rule-${groupIndex}-${ruleIndex}`,
          openshift_io_alert_source: groupIndex === 0 ? 'platform' : 'user',
        },
      })),
    })),
  },
});

export const getMockAlertsResponse = (): GetAlertsResponse => ({
  data: {
    alerts: getMockManagementRulesResponse().data.groups.flatMap((group) =>
      group.rules.flatMap((rule) =>
        rule.type === 'alerting'
          ? rule.alerts.map((alert) => ({
              ...alert,
              activeAt: alert.activeAt ?? new Date(mockTime).toISOString(),
              alertRuleId: rule.labels.openshift_io_alert_rule_id,
              labels: { ...rule.labels, ...alert.labels },
            }))
          : [],
      ),
    ),
  },
});

export const getMockSilencesResponse = (): Silence[] =>
  structuredClone(silencesResponse) as Silence[];
