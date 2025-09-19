import { AlertSeverity, TableColumn } from '@openshift-console/dynamic-plugin-sdk';
import { AggregatedAlert } from '../../AlertsAggregates';
import * as _ from 'lodash-es';
import { useMemo } from 'react';
import { sortable } from '@patternfly/react-table';
import { ListOrder } from '../../../../components/utils';
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

const useAggregateAlertColumns = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const columns = useMemo<TableColumn<AggregatedAlert>[]>(() => {
    const cols: TableColumn<AggregatedAlert>[] = [
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
        title: t('State'),
        transforms: [sortable],
      },
    ];
    return cols;
  }, [t]);

  return columns;
};

export default useAggregateAlertColumns;
