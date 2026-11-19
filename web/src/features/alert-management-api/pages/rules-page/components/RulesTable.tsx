import { ResourceIcon } from '@openshift-console/dynamic-plugin-sdk';
import { Checkbox, DropdownItem, Flex, FlexItem } from '@patternfly/react-core';
import { Table, Tbody, Td, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import { AlertStateSummary } from '@/features/alert-management-api/components/AlertStateSummary';
import { SortedColumnCells } from '@/features/alert-management-api/components/SortedColumnCells';
import { RulesTableHeader } from '@/features/alert-management-api/pages/rules-page/components/RulesTableHeader';
import {
  RuleColumn,
  ruleColumns,
  ruleLabel,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import type { ManagedRule } from '@/features/alert-management-api/types/types';
import type { RuleSort } from '@/features/alert-management-api/utils/sort-rules';
import KebabDropdown from '@/shared/components/KebabDropdown';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { EmptyBox } from '@/shared/console/console-shared/src/components/empty-state/EmptyBox';
import { RuleResource } from '@/shared/utils/utils';

type RulesTableProps = {
  rules: ManagedRule[];
  columns: RuleColumn[];
  sort: RuleSort;
  onSort: (column: RuleColumn, direction: RuleSort['direction']) => void;
  selected: Set<string>;
  onSelect: (ids: string[], checked: boolean) => void;
};

export function RulesTable({ rules, columns, sort, onSort, selected, onSelect }: RulesTableProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const selectionColumn = {
    modifier: 'fitContent' as const,
    isStickyColumn: true,
    stickyMinWidth: '2rem',
    stickyLeftOffset: '0',
  };

  const nameColumn = {
    modifier: 'nowrap' as const,
    isStickyColumn: columns[0] === 'name',
    hasRightBorder: columns[0] === 'name',
    stickyMinWidth: '12rem',
    stickyLeftOffset: '2rem',
  };

  const cell = (rule: ManagedRule, column: RuleColumn) => {
    switch (column) {
      case 'name':
        return (
          <Flex flexWrap={{ default: 'nowrap' }} spaceItems={{ default: 'spaceItemsNone' }}>
            <ResourceIcon kind={RuleResource.kind} />
            <FlexItem>{rule.name}</FlexItem>
          </Flex>
        );
      case 'enablement':
        return (
          <AlertStateSummary
            enablement={rule.enablement}
            firingAlertCount={rule.firingAlertCount}
            pendingAlertCount={rule.pendingAlertCount}
            silencedAlertCount={rule.silencedAlertCount}
          />
        );
      case 'severity':
        return <SeverityBadge severity={rule.severity} />;
      case 'source':
        return ruleLabel(rule.source, t);
      case 'scope':
        return ruleLabel(rule.scope, t);
      case 'namespace':
        return rule.namespace || '-';
      case 'managedBy':
        return ruleLabel(rule.managedBy, t);
      default:
        return rule[column];
    }
  };

  return (
    <Table role="table" aria-label={t('Alert rules table')} variant="compact" gridBreakPoint="">
      <RulesTableHeader
        rules={rules}
        columns={columns}
        sort={sort}
        onSort={onSort}
        selected={selected}
        onSelect={onSelect}
        selectionColumn={selectionColumn}
        nameColumn={nameColumn}
      />
      <Tbody>
        {rules.map((rule) => (
          <Tr key={rule.id}>
            <Td {...selectionColumn}>
              <Checkbox
                id={`select-rule-${rule.id}`}
                aria-label={t('Select {{name}}', { name: rule.name })}
                isChecked={selected.has(rule.id)}
                onChange={(_event, checked) => onSelect([rule.id], checked)}
              />
            </Td>
            <SortedColumnCells
              columns={columns}
              cells={ruleColumns.map(({ key, label }) => ({
                column: key,
                component: (
                  <Td dataLabel={ruleLabel(label, t)} {...(key === 'name' ? nameColumn : {})}>
                    {cell(rule, key)}
                  </Td>
                ),
              }))}
            />
            <Td isActionCell>
              <RuleActions rule={rule} />
            </Td>
          </Tr>
        ))}
        {rules.length === 0 && (
          <Tr>
            <Td colSpan={columns.length + 2}>
              <EmptyBox customMessage={t('No alert rules found')} />
            </Td>
          </Tr>
        )}
      </Tbody>
    </Table>
  );
}

function RuleActions({ rule }: { rule: ManagedRule }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const actions = [
    { key: 'edit', label: t('Edit alert rule') },
    rule.enablement === 'Disabled'
      ? { key: 'enable', label: t('Enable') }
      : { key: 'disable', label: t('Disable') },
    { key: 'duplicate', label: t('Duplicate') },
    { key: 'silence', label: t('Silence alert rule') },
    { key: 'delete', label: t('Delete') },
  ];

  return (
    <KebabDropdown
      ariaLabel={t('Actions for {{name}}', { name: rule.name })}
      dropdownItems={actions.map(({ key, label }) => (
        <DropdownItem
          key={key}
          isDanger={key === 'delete'}
          // Placeholder actions: no management API mutations until the editors are implemented.
          // eslint-disable-next-line no-console
          onClick={() => console.debug(`Alert rule ${key}: ${rule.name}, id: ${rule.id}`)}
        >
          {label}
        </DropdownItem>
      ))}
    />
  );
}
