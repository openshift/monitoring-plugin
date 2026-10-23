import { Badge, Button, Flex, FlexItem } from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import { Tbody, Td, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import { AggregatedRow } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AggregatedRow';
import { AlertRow } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertRow';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import type { OptionalAlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { AlertGroupBy } from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import type { AlertGroup } from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { compareSeverities } from '@/features/alert-management-api/utils/sort-alerts';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { startCase } from '@/shared/utils/strings';

type GroupRowProps = {
  group: AlertGroup;
  groupBy: AlertGroupBy;
  isExpanded: boolean;
  isAggregated: boolean;
  firstRowIndex: number;
  expandedAggregate: Set<string>;
  onGroupToggle: () => void;
  onToggleAggregate: (key: string) => void;
  startColumns: StartColumnsConfiguration;
  columns: Set<OptionalAlertColumn>;
  selection: AlertSelection;
};

export function GroupRow({
  group,
  groupBy,
  isExpanded,
  isAggregated,
  firstRowIndex,
  expandedAggregate,
  onGroupToggle,
  onToggleAggregate,
  startColumns,
  columns,
  selection,
}: GroupRowProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const severityCounts: Record<string, number> = {};
  const alertCount = group.rows.reduce((count, row) => {
    severityCounts[row.severity] = (severityCounts[row.severity] ?? 0) + 1;
    return count + row.alerts.length;
  }, 0);
  const groupLabel = (() => {
    switch (groupBy) {
      case AlertGroupBy.Severity:
        return t('Severity');
      case AlertGroupBy.Scope:
        return t('Alert scope');
      case AlertGroupBy.Component:
      default:
        return t('Component');
    }
  })();
  const label = t('{{group}}: {{value}} ({{count}} alerts)', {
    group: groupLabel,
    value:
      groupBy === AlertGroupBy.Severity || groupBy === AlertGroupBy.Scope
        ? t(startCase(group.value))
        : group.value,
    count: alertCount,
  });

  return (
    <Tbody isExpanded={isExpanded} style={{ verticalAlign: 'middle' }}>
      <Tr>
        <Td {...startColumns.expandColumn} hasAction>
          <Button
            id={`alert-group-${group.key}`}
            variant="plain"
            size="sm"
            aria-label={t('Toggle group: {{group}}', { group: label })}
            aria-expanded={isExpanded}
            onClick={onGroupToggle}
            icon={isExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
          />
        </Td>
        <Td {...startColumns.selectionColumn} />
        <Td {...startColumns.nameColumn}>
          <strong>{label}</strong>
        </Td>
        <Td>
          <Flex spaceItems={{ default: 'spaceItemsSm' }}>
            {Object.entries(severityCounts)
              .sort(([first], [second]) => compareSeverities(first, second))
              .map(([severity, count]) => (
                <FlexItem key={severity}>
                  <SeverityBadge severity={severity} count={count} />
                </FlexItem>
              ))}
          </Flex>
        </Td>
        {isAggregated && columns.has('total') && (
          <Td>
            <Badge isRead>{alertCount}</Badge>
          </Td>
        )}
        <Td colSpan={1 + [...columns].filter((column) => column !== 'total').length} />
      </Tr>
      {isExpanded &&
        group.rows.map((aggregatedAlert, index) =>
          isAggregated ? (
            <AggregatedRow
              key={aggregatedAlert.key}
              aggregatedAlert={aggregatedAlert}
              rowIndex={firstRowIndex + index}
              isExpanded={expandedAggregate.has(aggregatedAlert.key)}
              onToggle={() => onToggleAggregate(aggregatedAlert.key)}
              startColumns={startColumns}
              columns={columns}
              selection={selection}
            />
          ) : (
            <AlertRow
              key={aggregatedAlert.key}
              alert={aggregatedAlert.alerts[0]}
              rowIndex={firstRowIndex + index}
              hasExpandColumn
              startColumns={startColumns}
              columns={columns}
              selection={selection}
            />
          ),
        )}
    </Tbody>
  );
}
