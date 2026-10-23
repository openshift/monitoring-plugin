import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';

import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';

export const testAlerts = ['Alert1', 'Alert1', 'Alert1', 'Alert3', 'Alert4', 'Alert5'].map(
  (name, index) =>
    toManagedAlert({
      activeAt: '2026-01-01T00:00:00Z',
      annotations: {},
      labels: {
        alertname: name,
        severity: index === 2 ? 'warning' : 'critical',
        namespace: index < 4 ? 'openshift-monitoring' : 'workloads',
        instance: `instance-${index}`,
      },
      rule: { id: name, name },
      state: AlertStates.Firing,
    } as never),
);
