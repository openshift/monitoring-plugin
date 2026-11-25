import { InnerScrollContainer, Table, Tbody } from '@patternfly/react-table';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AggregatedRow } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AggregatedRow';
import { AlertRow } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertRow';
import { AlertsTableHeader } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertsTableHeader';
import { GroupRow } from '@/features/alert-management-api/pages/alerts-page/alerts-table/GroupRow';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import {
  AlertColumn,
  defaultAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import {
  AlertGroup,
  AlertGroupBy,
} from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { AlertSort } from '@/features/alert-management-api/utils/sort-alerts';
import { EmptyBox } from '@/shared/console/console-shared/src/components/empty-state/EmptyBox';

export type AlertsTableRef = {
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
};

type AlertsTableProps = {
  aggregatedAlerts: AggregatedAlert[];
  // Groups shown on the current paginated page
  pageGroups?: AlertGroup[];
  groupBy?: AlertGroupBy;
  isAggregated: boolean;
  columns?: AlertColumn[];
  sort: AlertSort;
  onSort: (nextSort: AlertSort) => void;
};

export const AlertsTable = forwardRef<AlertsTableRef, AlertsTableProps>(function AlertsTable(
  {
    aggregatedAlerts: alerts,
    pageGroups: groups = [],
    groupBy = AlertGroupBy.None,
    isAggregated,
    columns: configuredColumns = defaultAlertColumns,
    sort,
    onSort,
  },
  ref,
) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [expandedAggregate, setExpandedAggregate] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  // Group column expansion state belongs in the table logically based on ownership but
  // the expand all and contract all buttons still need to be located in the parent, so
  // expose those functions explicitly to the parent
  useImperativeHandle(
    ref,
    () => ({
      expandAllGroups: () =>
        setExpandedGroups((current) => new Set([...current, ...groups.map(({ key }) => key)])),
      collapseAllGroups: () =>
        setExpandedGroups((current) => {
          const next = new Set(current);
          groups.forEach(({ key }) => next.delete(key));
          return next;
        }),
    }),
    [groups],
  );
  const hasExpandColumn = isAggregated || groupBy !== AlertGroupBy.None;

  const toggleAggregatedRow = (key: string) => {
    setExpandedAggregate((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const toggleGroupRow = (key: string) => {
    return setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const columns = configuredColumns.filter((column) => isAggregated || column !== 'total');
  const startColumns = getStartColumnConfiguration(hasExpandColumn, columns[0] === 'name');
  let rowOffset = 0;

  if (alerts.length === 0) {
    return <EmptyBox customMessage={t('No alerts found')} />;
  }

  return (
    <InnerScrollContainer tabIndex={0} role="region" aria-label={t('Alerts table scroll area')}>
      <Table
        aria-label={t('Alerts')}
        className="pf-m-nowrap"
        variant="compact"
        isExpandable={hasExpandColumn}
        gridBreakPoint=""
      >
        <AlertsTableHeader
          startColumns={startColumns}
          hasExpandColumn={hasExpandColumn}
          columns={columns}
          sort={sort}
          onSort={onSort}
        />
        {groupBy !== AlertGroupBy.None
          ? groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const firstRowIndex = rowOffset;
              rowOffset += group.rows.length;
              return (
                <GroupRow
                  key={group.key}
                  group={group}
                  groupBy={groupBy}
                  isExpanded={isExpanded}
                  isAggregated={isAggregated}
                  firstRowIndex={firstRowIndex}
                  expandedAggregate={expandedAggregate}
                  onGroupToggle={() => toggleGroupRow(group.key)}
                  onToggleAggregate={toggleAggregatedRow}
                  startColumns={startColumns}
                  columns={columns}
                />
              );
            })
          : isAggregated
            ? alerts.map((aggregatedAlerts, rowIndex) => (
                <Tbody
                  key={aggregatedAlerts.key}
                  isExpanded={expandedAggregate.has(aggregatedAlerts.key)}
                  style={{ verticalAlign: 'middle' }}
                >
                  <AggregatedRow
                    key={aggregatedAlerts.key}
                    aggregatedAlert={aggregatedAlerts}
                    rowIndex={rowIndex}
                    isExpanded={expandedAggregate.has(aggregatedAlerts.key)}
                    onToggle={() => toggleAggregatedRow(aggregatedAlerts.key)}
                    startColumns={startColumns}
                    columns={columns}
                  />
                </Tbody>
              ))
            : alerts.map((aggregate) => (
                <Tbody
                  key={aggregate.key}
                  isExpanded={expandedAggregate.has(aggregate.key)}
                  style={{ verticalAlign: 'middle' }}
                >
                  <AlertRow
                    alert={aggregate.alerts[0]}
                    hasExpandColumn={false}
                    startColumns={startColumns}
                    columns={columns}
                  />
                </Tbody>
              ))}
      </Table>
    </InnerScrollContainer>
  );
});

AlertsTable.displayName = 'AlertsTable';

const getStartColumnConfiguration = (hasExpandColumn: boolean, isNameFirst: boolean) => {
  const expandColumn: StartColumnsConfiguration['expandColumn'] = {
    modifier: 'fitContent' as const,
    isStickyColumn: true,
    stickyMinWidth: '3rem',
  };
  const nameColumn: StartColumnsConfiguration['nameColumn'] = {
    isStickyColumn: isNameFirst,
    hasRightBorder: isNameFirst,
    stickyMinWidth: '12rem',
    stickyLeftOffset: hasExpandColumn ? '3rem' : '0',
  };

  return { expandColumn, nameColumn };
};
