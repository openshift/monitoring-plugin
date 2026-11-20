import { Checkbox } from '@patternfly/react-core';
import { Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import {
  ColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/components/SortedColumnCells';
import type { RuleColumn } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import type { ManagedRule } from '@/features/alert-management-api/types/types';
import type { RuleSort } from '@/features/alert-management-api/utils/sort-rules';

type RulesTableHeaderProps = {
  rules: ManagedRule[];
  columns: RuleColumn[];
  sort: RuleSort;
  onSort: (column: RuleColumn, direction: RuleSort['direction']) => void;
  selected: Set<string>;
  onSelect: (ids: string[], checked: boolean) => void;
  selectionColumn: ThProps;
  nameColumn: ThProps;
};

export function RulesTableHeader({
  rules,
  columns,
  sort,
  onSort,
  selected,
  onSelect,
  selectionColumn,
  nameColumn,
}: RulesTableHeaderProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const count = rules.filter(({ id }) => selected.has(id)).length;
  const sortBy = {
    index: columns.indexOf(sort.column),
    direction: sort.direction,
  };
  const sortHeader = (column: RuleColumn): NonNullable<ThProps['sort']> => ({
    columnIndex: columns.indexOf(column),
    sortBy,
    onSort: (_event, _index, direction) => onSort(column, direction),
  });

  const cells: ColumnCell<RuleColumn>[] = [
    {
      column: 'name',
      component: (
        <Th {...nameColumn} sort={sortHeader('name')}>
          {t('Alert rule name')}
        </Th>
      ),
    },
    {
      column: 'enablement',
      component: (
        <Th modifier="wrap" sort={sortHeader('enablement')}>
          {t('State')}
        </Th>
      ),
    },
    {
      column: 'severity',
      component: (
        <Th
          modifier="wrap"
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
    {
      column: 'scope',
      component: (
        <Th
          modifier="wrap"
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
          modifier="wrap"
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
          modifier="wrap"
          sort={sortHeader('source')}
          info={{
            tooltip: t('Origin of the alert rule (User or Platform)'),
            ariaLabel: t('More about {{column}}', { column: t('Source') }),
          }}
        >
          {t('Source')}
        </Th>
      ),
    },
    {
      column: 'namespace',
      component: (
        <Th modifier="wrap" sort={sortHeader('namespace')}>
          {t('Namespace')}
        </Th>
      ),
    },
    {
      column: 'managedBy',
      component: (
        <Th modifier="wrap" sort={sortHeader('managedBy')}>
          {t('Managed by')}
        </Th>
      ),
    },
  ];

  return (
    <Thead>
      <Tr>
        <Th {...selectionColumn}>
          <Checkbox
            id="select-page-rules"
            aria-label={t('Select all rules on this page')}
            isDisabled={rules.length === 0}
            isChecked={count > 0 && count < rules.length ? null : count > 0}
            onChange={(_event, checked) =>
              onSelect(
                rules.map(({ id }) => id),
                checked,
              )
            }
          />
        </Th>
        <SortedColumnCells columns={columns} cells={cells} />
        <Th screenReaderText={t('Actions')} />
      </Tr>
    </Thead>
  );
}
