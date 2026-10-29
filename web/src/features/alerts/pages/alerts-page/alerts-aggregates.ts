import { Alert } from '@openshift-console/dynamic-plugin-sdk';

import type { AggregatedAlert } from '@/shared/types/types';

export const getAggregatedAlertKey = (alert: Alert): string =>
  `${alert.labels.alertname}-${alert.labels?.severity}-${alert.state}`;

export const getAggregateAlertsLists = (data: Alert[]): AggregatedAlert[] => {
  const aggregatedAlertsMap = (data || []).reduce((aggregatedAlertsMap, alert) => {
    const key = getAggregatedAlertKey(alert);

    if (!aggregatedAlertsMap.has(key)) {
      aggregatedAlertsMap.set(key, {
        name: alert.labels.alertname,
        severity: alert.labels?.severity,
        state: alert.state,
        alerts: [],
      });
    }

    const aggregatedAlert = aggregatedAlertsMap.get(key);
    aggregatedAlert.alerts.push(alert);

    return aggregatedAlertsMap;
  }, new Map<string, AggregatedAlert>());

  return Array.from(aggregatedAlertsMap.values());
};
