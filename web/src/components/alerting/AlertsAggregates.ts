import { Alert } from '@openshift-console/dynamic-plugin-sdk';

export type AggregatedAlert = {
  severity: Alert['labels']['severity'];
  alerts: Alert[];
  name: Alert['labels']['alertname'];
  states: Set<Alert['state']>;
};

export const getAggregatedAlertKey = (alert: Alert): string =>
  `${alert.labels.alertname}-${alert.labels?.severity}`;

export const getAggregateAlertsLists = (data: Alert[]): AggregatedAlert[] => {
  const aggregatedAlertsMap = (data || []).reduce((aggregatedAlertsMap, alert) => {
    const key = getAggregatedAlertKey(alert);

    if (!aggregatedAlertsMap.has(key)) {
      aggregatedAlertsMap.set(key, {
        name: alert.labels.alertname,
        severity: alert.labels?.severity,
        alerts: [],
        states: new Set(),
      });
    }

    const aggregatedAlert = aggregatedAlertsMap.get(key);
    aggregatedAlert.alerts.push(alert);
    aggregatedAlert.states.add(alert.state);

    return aggregatedAlertsMap;
  }, new Map<string, AggregatedAlert>());

  return Array.from(aggregatedAlertsMap.values());
};
