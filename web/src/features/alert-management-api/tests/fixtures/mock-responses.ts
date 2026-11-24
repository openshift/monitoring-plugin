import { Silence } from '@openshift-console/dynamic-plugin-sdk';

import rulesResponse from '@/features/alert-management-api/tests/fixtures/rules.json';
import silencesResponse from '@/features/alert-management-api/tests/fixtures/silences.json';
import {
  AlertingRule,
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
const components = [
  'Compute',
  'Networking',
  'Storage',
  'Workload',
  'kube-apiserver',
  'etcd',
  'Scheduler',
  'Controller',
];

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
    {
      alerts: [],
      annotations: {},
      duration: 0,
      labels: { prometheus: 'openshift-user-workload-monitoring', severity: 'warning' },
      name: 'WorkloadAvailability',
      query: 'up == 0',
      state: 'inactive',
      type: 'alerting',
    },
  ],
};

export const getMockRulesResponse = (): GetRulesResponse => {
  const response: GetRulesResponse = {
    data: {
      groups: [...structuredClone(rulesResponse.data.groups), structuredClone(namespaceRules)].map(
        (group) => ({
          ...group,
          interval: 30,
          limit: 0,
          evaluationTime: 0,
          lastEvaluation: new Date(mockTime).toISOString(),
          rules: group.rules.map((rule) => ({
            ...rule,
            type: 'alerting',
            state: 'state' in rule ? rule.state : (rule.alerts[0]?.state ?? 'inactive'),
            keepFiringFor: 0,
            health: 'ok',
            evaluationTime: 0,
            lastEvaluation: new Date(mockTime).toISOString(),
          })),
        }),
      ),
    },
  };
  response.data.groups.forEach((group, groupIndex) => {
    group.rules.forEach((rule, ruleIndex) => {
      const component = components[(groupIndex + ruleIndex) % components.length];
      rule.labels.openshift_io_alert_rule_component = component;
      rule.labels.openshift_io_alert_rule_id = `rid_mock_${groupIndex}_${ruleIndex}`;
      rule.labels.openshift_io_alert_source =
        rule.labels.prometheus === 'openshift-monitoring/k8s' ? 'platform' : 'user';
      rule.labels.openshift_io_prometheus_rule_namespace =
        groupIndex === 0 ? 'openshift-monitoring' : namespaces[ruleIndex % namespaces.length];
      rule.labels.openshift_io_rule_managed_by = groupIndex === 0 ? 'operator' : 'gitops';
      rule.labels.team = groupIndex === 0 ? 'platform' : 'application';
      rule.labels.environment = ruleIndex % 2 === 0 ? 'production' : 'staging';
      // UI-only metadata until the management read API exposes enablement.
      // Keep pending examples available in the data-driven state filters.
      const hasPendingAlerts =
        rule.type === 'alerting' && rule.alerts.some((alert) => alert.state === 'pending');
      const alertingRuleEnabled = hasPendingAlerts || (groupIndex + ruleIndex) % 4 !== 0;
      Object.assign(rule, { alertingRuleEnabled });
      if (rule.type !== 'alerting') {
        return;
      }
      if (!alertingRuleEnabled) {
        rule.alerts = [];
        rule.state = 'inactive';
      }
      rule.alerts.forEach((alert, alertIndex) => {
        const resourceIndex = Math.floor(ruleIndex / 8) + Math.floor(alertIndex / 3) + 1;
        alert.labels.component = component;
        alert.labels.resource = `${component.toLowerCase()}-${resourceIndex}`;
      });
    });
  });
  response.data.groups[0].rules.push({
    type: 'recording',
    name: 'job:up:sum',
    query: 'sum(up) by (job)',
    labels: {},
    health: 'ok',
    evaluationTime: 0,
    lastEvaluation: new Date(mockTime).toISOString(),
  });
  return response;
};

export const getMockAlertingRulesResponse = (response = getMockRulesResponse()): AlertingRule[] =>
  response.data.groups.flatMap((group) => group.rules).filter((rule) => rule.type === 'alerting');

export const getMockSilencesResponse = (): Silence[] =>
  structuredClone(silencesResponse) as Silence[];

export const getMockAlertsResponse = (): GetAlertsResponse => ({
  data: {
    alerts: getMockAlertingRulesResponse().flatMap((rule) =>
      rule.alerts.map((alert, index) => ({
        ...alert,
        labels: { ...rule.labels, alertname: rule.name, ...alert.labels },
        activeAt: alert.activeAt ?? minutesAgo(1),
        value: String(alert.value ?? ''),
        state: alert.state === 'firing' && index % 2 === 0 ? 'silenced' : alert.state,
        alertRuleId: rule.labels.openshift_io_alert_rule_id,
      })),
    ),
  },
});
