import { AlertSeverity } from '@openshift-console/dynamic-plugin-sdk';

import { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { getFiringSinceTimestamp } from '@/features/alert-management-api/utils/alert-values';

const severityOrder = {
  [AlertSeverity.Critical]: 4,
  [AlertSeverity.Warning]: 3,
  [AlertSeverity.Info]: 2,
  [AlertSeverity.None]: 1,
} as const;

export const compareSeverities = (first: string, second: string) => {
  const severityOne = severityOrder[first] ?? 0;
  const severityTwo = severityOrder[second] ?? 0;
  if (severityOne === 0 && severityTwo === 0) {
    return first.localeCompare(second);
  }
  return severityTwo - severityOne;
};

export const sortColumns = [
  'name',
  'severity',
  'total',
  'state',
  'scope',
  'component',
  'source',
  'description',
  'firingSince',
  'namespace',
  'resource',
] as const;

export type AlertSort = {
  column: (typeof sortColumns)[number];
  direction: 'asc' | 'desc';
};

export const defaultAlertSort: AlertSort = { column: 'severity', direction: 'asc' };

export const compareAggregatedAlerts = (first: AggregatedAlert, second: AggregatedAlert) =>
  compareSeverities(first.severity, second.severity) ||
  first.alertScope.localeCompare(second.alertScope) ||
  first.component.localeCompare(second.component) ||
  first.name.localeCompare(second.name) ||
  first.source.localeCompare(second.source) ||
  first.key.localeCompare(second.key);

export const sortAlerts = (alerts: AggregatedAlert[], sort: AlertSort): AggregatedAlert[] => {
  return [...alerts].sort((first, second) => {
    let result: number;
    switch (sort.column) {
      case 'name':
        result = first.name.localeCompare(second.name);
        break;
      case 'severity':
        result = compareSeverities(first.severity, second.severity);
        break;
      case 'total':
        result = first.alerts.length - second.alerts.length;
        break;
      case 'state':
        result = first.state.join(', ').localeCompare(second.state.join(', '));
        break;
      case 'scope':
        result = first.alertScope.localeCompare(second.alertScope);
        break;
      case 'component':
        result = first.component.localeCompare(second.component);
        break;
      case 'source':
        result = first.source.localeCompare(second.source);
        break;
      case 'description':
        result = (
          first.alerts[0]?.annotations.description ??
          first.alerts[0]?.annotations.summary ??
          ''
        ).localeCompare(
          second.alerts[0]?.annotations.description ?? second.alerts[0]?.annotations.summary ?? '',
        );
        break;
      case 'firingSince':
        result = getFiringSinceTimestamp(first.alerts) - getFiringSinceTimestamp(second.alerts);
        break;
      case 'namespace':
        result = (first.alerts[0]?.labels.namespace ?? '').localeCompare(
          second.alerts[0]?.labels.namespace ?? '',
        );
        break;
      case 'resource':
        result = (first.alerts[0]?.labels.resource ?? '').localeCompare(
          second.alerts[0]?.labels.resource ?? '',
        );
        break;
    }
    return (sort.direction === 'asc' ? result : -result) || compareAggregatedAlerts(first, second);
  });
};
