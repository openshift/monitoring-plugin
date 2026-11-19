import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';

import {
  makeManagedAlert,
  makeRule,
} from '@/features/alert-management-api/tests/utils/object-factories';

export const testAlerts = ['Alert1', 'Alert1', 'Alert1', 'Alert3', 'Alert4', 'Alert5'].map(
  (name, index) =>
    makeManagedAlert({
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
      rule: makeRule({
        id: name,
        name,
        duration: 600,
        query: 'sum(rate(container_cpu_usage_seconds_total{namespace="test"}[5m])) > 1',
      }),
      state: AlertStates.Firing,
    }),
);
