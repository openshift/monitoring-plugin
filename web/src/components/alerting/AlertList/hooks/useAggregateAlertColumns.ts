import {
  Alert,
  AlertSeverity,
  AlertStates,
  TableColumn,
} from '@openshift-console/dynamic-plugin-sdk';
import { AggregatedAlert } from '../../AlertsAggregates';
import * as _ from 'lodash-es';
import * as React from 'react';
import { sortable } from '@patternfly/react-table';
import { alertState, ListOrder } from '../../../../components/utils';
import { useTranslation } from 'react-i18next';

export const alertSeverityOrder = (aggregatedAlert: AggregatedAlert): ListOrder => {
  const order: number =
    {
      [AlertSeverity.Critical]: 1,
      [AlertSeverity.Warning]: 2,
      [AlertSeverity.None]: 4,
    }[aggregatedAlert.severity] ?? 3;
  return [order, aggregatedAlert.severity];
};

// Sort alerts by their state (sort first by the state itself, then by the timestamp relevant to
// the state)
const alertStateOrder = (alert: Alert) => [
  [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].indexOf(alertState(alert)),
  alertState(alert) === AlertStates.Silenced
    ? _.max(_.map(alert.silencedBy, 'endsAt'))
    : _.get(alert, 'activeAt'),
];

const useAggregateAlertColumns = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const columns = React.useMemo<TableColumn<AggregatedAlert>[]>(() => {
    const cols = [
      {
        title: '',
        id: '',
      },
      {
        id: 'name',
        sort: 'name',
        title: t('Name'),
        transforms: [sortable],
      },
      {
        id: 'severity',
        sort: (alerts: AggregatedAlert[], direction: 'asc' | 'desc') =>
          _.orderBy(alerts, alertSeverityOrder, [direction]),
        title: t('Severity'),
        transforms: [sortable],
      },
      {
        id: 'total',
        sort: 'alerts.length',
        title: t('Total'),
        transforms: [sortable],
      },
      {
        id: 'state',
        sort: (alerts: AggregatedAlert[], direction: 'asc' | 'desc') =>
          _.orderBy(alerts, alertStateOrder, [direction]),
        title: t('State'),
        transforms: [sortable],
      },
    ];
    return cols;
  }, [t]);

  return columns;
};

export default useAggregateAlertColumns;
