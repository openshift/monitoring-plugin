import { Alert, AlertSeverity } from '@openshift-console/dynamic-plugin-sdk';

import {
  AggregatedAlert,
  AlertFilterOption,
  AlertFilters,
  ManagedAlert,
} from '@/features/alert-management-api/types/types';
import { getFiringTimeRange } from '@/features/alert-management-api/utils/firing-time';
import { compareAggregatedAlerts } from '@/features/alert-management-api/utils/sort-alerts';
import { alertSource } from '@/shared/utils/alerts/alert-source';

export const defaultAlertFilters: AlertFilters = {
  name: '',
  scope: [],
  component: [],
  severity: [],
  state: [],
  source: [],
  namespace: [],
  labels: [],
  firingTime: '',
};

const removeDefaultAlertLabels = (alert: ManagedAlert) =>
  Object.entries(alert.labels)
    .filter(
      ([key]) =>
        ![
          'alertname',
          'namespace',
          'severity',
          'openshift_io_alert_backend',
          'openshift_io_alert_rule_id',
          'openshift_io_alert_source',
        ].includes(key),
    )
    .map(([name, value]) => ({
      value: `${name}=${value}`,
      label: `${name}=${value}`,
    }));

export const toManagedAlert = (alert: Alert & { alertComponent?: string }): ManagedAlert => ({
  ...alert,
  alertScope: /^(kube-|openshift-)/.test(alert.labels.namespace ?? '') ? 'Cluster' : 'Namespace',
  component: alert.alertComponent ?? alert.labels.component ?? 'component',
  source: alertSource(alert),
});

export const getAlertStableKey = (alert: ManagedAlert) =>
  JSON.stringify([
    alert.rule.id,
    Object.entries(alert.labels).sort(([first], [second]) => first.localeCompare(second)),
  ]);

const matches = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value);

// Ensure that the alert include all items in the labels
const matchFilters = (alert: ManagedAlert, labels: string[]) => {
  const alertLabels = removeDefaultAlertLabels(alert).map(({ value }) => value);
  return labels.every((label) => alertLabels.includes(label));
};

const matchName = (alert: ManagedAlert, name: string) => {
  const alertName = alert.labels.alertname ?? alert.rule.name;
  return alertName.toLocaleLowerCase().includes(name.toLocaleLowerCase());
};

export const filterAlerts = (alerts: ManagedAlert[], filters: AlertFilters) => {
  const firingTimeRange = getFiringTimeRange(filters.firingTime);

  return alerts.filter((alert) => {
    const activeAt = Date.parse(alert.activeAt);
    return (
      matches(filters.scope, alert.alertScope) &&
      matches(filters.component, alert.component) &&
      // Since we need to fall back to none for the aggregation, do so for filtering
      matches(filters.severity, alert.labels.severity ?? AlertSeverity.None) &&
      matches(filters.state, alert.state) &&
      matches(filters.source, alert.source) &&
      matches(filters.namespace, alert.labels.namespace) &&
      matchFilters(alert, filters.labels) &&
      matchName(alert, filters.name) &&
      (!firingTimeRange || (activeAt >= firingTimeRange.from && activeAt <= firingTimeRange.to))
    );
  });
};

export const aggregateAlerts = (alerts: ManagedAlert[]): AggregatedAlert[] => {
  const aggregates = new Map<string, AggregatedAlert>();

  alerts.forEach((alert) => {
    const alertName = alert.labels.alertname ?? alert.rule.name;
    const severity = alert.labels.severity ?? AlertSeverity.None;

    const aggregationKey = [
      alertName,
      severity,
      alert.alertScope,
      alert.component,
      alert.source,
    ].join('');

    const existingAggregate = aggregates.get(aggregationKey);
    if (existingAggregate) {
      existingAggregate.alerts.push(alert);
      if (!existingAggregate.state.includes(alert.state)) {
        existingAggregate.state.push(alert.state);
      }
      return;
    }

    aggregates.set(aggregationKey, {
      key: aggregationKey,
      name: alertName,
      severity,
      alertScope: alert.alertScope,
      component: alert.component,
      source: alert.source,
      state: [alert.state],
      alerts: [alert],
    });
  });
  return [...aggregates.values()].sort(compareAggregatedAlerts);
};

type FilterOptionKey = Exclude<keyof AlertFilters, 'name' | 'firingTime'>;

const getAlertValue = (alert: ManagedAlert, key: FilterOptionKey) => {
  if (key === 'labels') {
    return removeDefaultAlertLabels(alert);
  }

  let value: string;
  switch (key) {
    case 'scope':
      value = alert.alertScope;
      break;
    case 'component':
      value = alert.component;
      break;
    case 'severity':
      value = alert.labels.severity ?? AlertSeverity.None;
      break;
    case 'state':
      value = alert.state;
      break;
    case 'source':
      value = alert.source;
      break;
    case 'namespace':
    default:
      value = alert.labels.namespace ?? '';
  }

  return value ? [{ value, label: value }] : [];
};

export const filterOptionsByKey = (
  alerts: ManagedAlert[],
  key: FilterOptionKey,
): AlertFilterOption[] => {
  const options = new Map<string, AlertFilterOption>();
  alerts.forEach((alert) => {
    getAlertValue(alert, key).forEach(({ value, label }) => {
      const existingOption = options.get(value);
      if (existingOption) {
        existingOption.count += 1;
      } else {
        options.set(value, { value, label, count: 1 });
      }
    });
  });
  return [...options.values()].sort((first, second) => first.label.localeCompare(second.label));
};
