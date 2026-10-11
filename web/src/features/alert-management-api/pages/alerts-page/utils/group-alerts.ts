import { AlertSeverity } from '@openshift-console/dynamic-plugin-sdk';

import { AggregatedAlert, ManagedAlert } from '@/features/alert-management-api/types/types';
import { aggregateAlerts, getAlertStableKey } from '@/features/alert-management-api/utils/alerts';
import {
  AlertSort,
  compareSeverities,
  sortAlerts,
} from '@/features/alert-management-api/utils/sort-alerts';

export enum AlertGroupBy {
  None = 'none',
  Severity = 'severity',
  Scope = 'scope',
  Component = 'component',
}

export type AlertGroup = {
  key: string;
  value: string;
  rows: AggregatedAlert[];
};

export const groupAlerts = (
  alerts: ManagedAlert[],
  groupBy: AlertGroupBy,
  isAggregated: boolean,
  sort: AlertSort,
): AlertGroup[] => {
  const partitions = new Map<string, ManagedAlert[]>();
  if (groupBy === AlertGroupBy.None) {
    partitions.set('', []);
  }
  alerts.forEach((alert) => {
    const value = (() => {
      switch (groupBy) {
        case AlertGroupBy.None:
          return '';
        case AlertGroupBy.Severity:
          return alert.labels.severity ?? AlertSeverity.None;
        case AlertGroupBy.Scope:
          return alert.alertScope;
        case AlertGroupBy.Component:
        default:
          return alert.component;
      }
    })();
    const partition = partitions.get(value);
    if (partition) {
      partition.push(alert);
    } else {
      partitions.set(value, [alert]);
    }
  });

  const selectionKeyCounts = new Map<string, number>();
  return [...partitions.entries()]
    .sort(([first], [second]) =>
      groupBy === AlertGroupBy.Severity
        ? compareSeverities(first, second)
        : first.localeCompare(second),
    )
    .map(([value, partition]) => {
      const rows = sortAlerts(
        isAggregated
          ? aggregateAlerts(partition)
          : partition.map((alert) => {
              const key = getAlertStableKey(alert);
              const occurrence = selectionKeyCounts.get(key) ?? 0;
              selectionKeyCounts.set(key, occurrence + 1);
              return {
                ...aggregateAlerts([alert])[0],
                key: occurrence === 0 ? key : `${key}:${occurrence}`,
              };
            }),
        sort,
      );
      return {
        key: groupBy === AlertGroupBy.None ? AlertGroupBy.None : `${groupBy}:${value}`,
        value,
        rows,
      };
    });
};

export const paginateAlertGroups = (
  groups: AlertGroup[],
  page: number,
  perPage: number,
): AlertGroup[] => {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  let offset = 0;
  return groups.flatMap((group) => {
    const rows = group.rows.slice(Math.max(0, start - offset), Math.max(0, end - offset));
    offset += group.rows.length;
    return rows.length > 0 ? [{ ...group, rows }] : [];
  });
};
