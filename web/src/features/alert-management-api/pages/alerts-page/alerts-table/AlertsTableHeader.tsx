import { Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import { AlertSelectionCheckbox } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import { optionalAlertColumns } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { OptionalAlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { AlertSort } from '@/features/alert-management-api/utils/sort-alerts';
import { DataTestIDs } from '@/shared/constants/data-test';

type AlertsTableHeaderProps = {
  alerts: AggregatedAlert[];
  startColumns: StartColumnsConfiguration;
  hasExpandColumn: boolean;
  isAggregated: boolean;
  columns: Set<OptionalAlertColumn>;
  sort: AlertSort;
  onSort: (nextSort: AlertSort) => void;
  selection: AlertSelection;
};

export function AlertsTableHeader({
  alerts,
  startColumns: { expandColumn, selectionColumn, nameColumn },
  hasExpandColumn,
  isAggregated,
  columns,
  sort,
  onSort,
  selection,
}: AlertsTableHeaderProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const visibleColumns = [
    'name',
    'severity',
    ...optionalAlertColumns
      .filter(({ key }) => columns.has(key) && (key !== 'total' || isAggregated))
      .map(({ key }) => key),
  ];
  const firstColumnIndex = hasExpandColumn ? 2 : 1;
  const sortBy = {
    index: visibleColumns.indexOf(sort.column) + firstColumnIndex,
    direction: sort.direction,
  };
  const sortHeader = (column: AlertSort['column']): NonNullable<ThProps['sort']> => ({
    columnIndex: visibleColumns.indexOf(column) + firstColumnIndex,
    sortBy,
    onSort: (_event, _index, direction) => onSort({ column, direction }),
  });

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
        <Th {...nameColumn} sort={sortHeader('name')}>
          {t('Alert name')}
        </Th>
        <Th
          sort={sortHeader('severity')}
          info={{
            tooltip: t('Severity column tooltip'),
            ariaLabel: t('More about {{column}}', { column: t('Severity') }),
          }}
        >
          {t('Severity')}
        </Th>
        {isAggregated && columns.has('total') && <Th sort={sortHeader('total')}>{t('Total')}</Th>}
        {columns.has('state') && <Th sort={sortHeader('state')}>{t('State')}</Th>}
        {columns.has('scope') && (
          <Th
            sort={sortHeader('scope')}
            info={{
              tooltip: t('Alert scope tooltip'),
              ariaLabel: t('More about {{column}}', { column: t('Alert scope') }),
            }}
          >
            {t('Alert scope')}
          </Th>
        )}
        {columns.has('component') && (
          <Th
            sort={sortHeader('component')}
            info={{
              tooltip: t('Affected components tooltip'),
              ariaLabel: t('More about {{column}}', { column: t('Affected component') }),
            }}
          >
            {t('Affected component')}
          </Th>
        )}
        {columns.has('source') && (
          <Th
            sort={sortHeader('source')}
            info={{
              tooltip: t('Source column tooltip'),
              ariaLabel: t('More about {{column}}', { column: t('Source') }),
            }}
          >
            {t('Source')}
          </Th>
        )}
        {columns.has('description') && (
          <Th sort={sortHeader('description')}>{t('Description (in alert)')}</Th>
        )}
        {columns.has('firingSince') && (
          <Th sort={sortHeader('firingSince')}>{t('Firing since')}</Th>
        )}
        {columns.has('runbookUrl') && <Th>{t('Runbook URL (in alert)')}</Th>}
        {columns.has('namespace') && (
          <Th sort={sortHeader('namespace')}>{t('Namespace (in alert)')}</Th>
        )}
        {columns.has('resource') && (
          <Th sort={sortHeader('resource')}>{t('Resource (in alert)')}</Th>
        )}
        <Th modifier="fitContent" screenReaderText={t('Actions')} />
      </Tr>
    </Thead>
  );
}
