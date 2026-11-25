import { Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import {
  ColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/components/table/SortedColumnCells';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { AlertSort } from '@/features/alert-management-api/utils/sort-alerts';

type AlertsTableHeaderProps = {
  startColumns: StartColumnsConfiguration;
  hasExpandColumn: boolean;
  columns: AlertColumn[];
  sort: AlertSort;
  onSort: (nextSort: AlertSort) => void;
};

export function AlertsTableHeader({
  startColumns: { expandColumn, nameColumn },
  hasExpandColumn,
  columns,
  sort,
  onSort,
}: AlertsTableHeaderProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const firstColumnIndex = hasExpandColumn ? 1 : 0;
  const sortBy = {
    index: columns.indexOf(sort.column) + firstColumnIndex,
    direction: sort.direction,
  };
  const sortHeader = (column: AlertSort['column']): NonNullable<ThProps['sort']> => ({
    columnIndex: columns.indexOf(column) + firstColumnIndex,
    sortBy,
    onSort: (_event, _index, direction) => onSort({ column, direction }),
  });

  const cells: ColumnCell<AlertColumn>[] = [
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
        <SortedColumnCells columns={columns} cells={cells} />
        <Th modifier="fitContent" screenReaderText={t('Actions')} />
      </Tr>
    </Thead>
  );
}
