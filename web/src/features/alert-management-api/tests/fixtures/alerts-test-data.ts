import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';

import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';

export const testAlerts = ['Alert1', 'Alert1', 'Alert1', 'Alert3', 'Alert4', 'Alert5'].map(
  (name, index) =>
    toManagedAlert({
      activeAt: '2026-01-01T00:00:00Z',
      annotations: {
        description: 'This is a long alert description that should wrap within its column.',
        runbook_url: 'https://example.com/runbook',
        dashboard_url: 'https://example.com/dashboard',
      },
      labels: {
        alertname: name,
        severity: index === 2 ? 'warning' : 'critical',
        namespace: index < 4 ? 'openshift-monitoring' : 'workloads',
        instance: `instance-${index}`,
        pod: 'test-pod',
        resource: 'test-resource',
        team: 'payments',
      },
      rule: {
        id: name,
        name,
        duration: 600,
        query: 'sum(rate(container_cpu_usage_seconds_total{namespace="test"}[5m])) > 1',
      },
      state: AlertStates.Firing,
    } as never),
);
