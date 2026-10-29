import { Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import { AlertSelectionCheckbox } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import {
  AlertColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/pages/alerts-page/alerts-table/SortedColumnCells';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { AlertSort } from '@/features/alert-management-api/utils/sort-alerts';
import { DataTestIDs } from '@/shared/constants/data-test';

type AlertsTableHeaderProps = {
  alerts: AggregatedAlert[];
  startColumns: StartColumnsConfiguration;
  hasExpandColumn: boolean;
  columns: AlertColumn[];
  sort: AlertSort;
  onSort: (nextSort: AlertSort) => void;
  selection: AlertSelection;
};

export function AlertsTableHeader({
  alerts,
  startColumns: { expandColumn, selectionColumn, nameColumn },
  hasExpandColumn,
  columns,
  sort,
  onSort,
  selection,
}: AlertsTableHeaderProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const firstColumnIndex = hasExpandColumn ? 2 : 1;
  const sortBy = {
    index: columns.indexOf(sort.column) + firstColumnIndex,
    direction: sort.direction,
  };
  const sortHeader = (column: AlertSort['column']): NonNullable<ThProps['sort']> => ({
    columnIndex: columns.indexOf(column) + firstColumnIndex,
    sortBy,
    onSort: (_event, _index, direction) => onSort({ column, direction }),
  });

  const cells: AlertColumnCell[] = [
    {
      column: 'name',
      component: (
        <Th {...nameColumn} sort={sortHeader('name')}>
          {t('Alert name')}
        </Th>
      ),
    },
    {
      column: 'severity',
      component: (
        <Th
          sort={sortHeader('severity')}
          info={{
            tooltip: t('Severity column tooltip'),
            ariaLabel: t('More about {{column}}', { column: t('Severity') }),
          }}
        >
          {t('Severity')}
        </Th>
      ),
    },
    { column: 'total', component: <Th sort={sortHeader('total')}>{t('Total')}</Th> },
    { column: 'state', component: <Th sort={sortHeader('state')}>{t('State')}</Th> },
    {
      column: 'scope',
      component: (
        <Th
          sort={sortHeader('scope')}
          info={{
            tooltip: t('Alert scope tooltip'),
            ariaLabel: t('More about {{column}}', { column: t('Alert scope') }),
          }}
        >
          {t('Alert scope')}
        </Th>
      ),
    },
    {
      column: 'component',
      component: (
        <Th
          sort={sortHeader('component')}
          info={{
            tooltip: t('Affected components tooltip'),
            ariaLabel: t('More about {{column}}', { column: t('Affected component') }),
          }}
        >
          {t('Affected component')}
        </Th>
      ),
    },
    {
      column: 'source',
      component: (
        <Th
          sort={sortHeader('source')}
          info={{
            tooltip: t('Source column tooltip'),
            ariaLabel: t('More about {{column}}', { column: t('Source') }),
          }}
        >
          {t('Source')}
        </Th>
      ),
    },
    {
      column: 'description',
      component: <Th sort={sortHeader('description')}>{t('Description (in alert)')}</Th>,
    },
    {
      column: 'firingSince',
      component: <Th sort={sortHeader('firingSince')}>{t('Firing since')}</Th>,
    },
    { column: 'runbookUrl', component: <Th>{t('Runbook URL (in alert)')}</Th> },
    {
      column: 'namespace',
      component: <Th sort={sortHeader('namespace')}>{t('Namespace (in alert)')}</Th>,
    },
    {
      column: 'resource',
      component: <Th sort={sortHeader('resource')}>{t('Resource (in alert)')}</Th>,
    },
  ];

  return (
    <Thead className="pf-m-nowrap">
      <Tr>
        {hasExpandColumn && <Th screenReaderText={t('Expand alert')} {...expandColumn} />}
        <Th modifier="fitContent" {...selectionColumn}>
          <AlertSelectionCheckbox
            alerts={alerts.flatMap((aggregate) => aggregate.alerts)}
            label={t('Select all alerts on this page')}
            id={DataTestIDs.AlertManagementAPI.SelectAllAlertsCheckbox}
            {...selection}
          />
        </Th>
        <SortedColumnCells columns={columns} cells={cells} />
        <Th modifier="fitContent" screenReaderText={t('Actions')} />
      </Tr>
    </Thead>
  );
}
