/** @vitest-environment jsdom */
import { Table } from '@patternfly/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { processAlertManagementData } from '@/features/alert-management-api/hooks/useAlertManagementData';
import { RulesTableHeader } from '@/features/alert-management-api/pages/rules-page/components/RulesTableHeader';
import {
  defaultRuleColumns,
  toManagedRule,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import {
  getMockAlertsResponse,
  getMockRulesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { defaultRuleSort } from '@/features/alert-management-api/utils/sort-rules';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? name)),
  }),
}));

const rules = processAlertManagementData(getMockRulesResponse(), getMockAlertsResponse(), {
  data: [],
  isLoading: false,
})!.rules.map(toManagedRule);

function renderHeader(props: Partial<ComponentProps<typeof RulesTableHeader>> = {}) {
  return render(
    <Table>
      <RulesTableHeader
        rules={rules}
        columns={defaultRuleColumns}
        sort={defaultRuleSort}
        onSort={vi.fn()}
        selected={new Set()}
        onSelect={vi.fn()}
        selectionColumn={{}}
        nameColumn={{}}
        {...props}
      />
    </Table>,
  );
}

it.each([
  ['Severity', 'Severity column tooltip'],
  ['Alert scope', 'Alert scope tooltip'],
  ['Affected component', 'Affected components tooltip'],
  ['Source', 'Origin of the alert rule (User or Platform)'],
])('provides an accessible tooltip for %s', async (column, tooltip) => {
  renderHeader();

  fireEvent.mouseEnter(screen.getByRole('button', { name: `More about ${column}` }));

  expect((await screen.findByRole('tooltip')).textContent).toBe(tooltip);
});

it('keeps reordered column headers and sorting aligned', () => {
  const onSort = vi.fn();
  renderHeader({ columns: ['source', 'name', 'severity', 'enablement'], onSort });

  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    '',
    'Source',
    'Alert rule name',
    'Severity',
    'State',
    'Actions',
  ]);

  fireEvent.click(screen.getByRole('button', { name: 'Severity' }));

  expect(onSort).toHaveBeenCalledWith('severity', 'asc');
});

it('selects only the supplied page of rules and indicates partial selection', () => {
  const pageRules = rules.slice(0, 2);
  const onSelect = vi.fn();
  renderHeader({ rules: pageRules, selected: new Set([pageRules[0].id]), onSelect });
  const checkbox = screen.getByRole('checkbox', {
    name: 'Select all rules on this page',
  }) as HTMLInputElement;

  expect(checkbox.indeterminate).toBe(true);

  fireEvent.click(checkbox);

  expect(onSelect).toHaveBeenCalledWith(
    pageRules.map(({ id }) => id),
    true,
  );
});

it('allows deselecting all rules on the current page', () => {
  const pageRules = rules.slice(0, 2);
  const ids = pageRules.map(({ id }) => id);
  const onSelect = vi.fn();
  renderHeader({ rules: pageRules, selected: new Set(ids), onSelect });

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rules on this page' }));

  expect(onSelect).toHaveBeenCalledWith(ids, false);
});

it('disables page selection when no rules are shown', () => {
  renderHeader({ rules: [] });

  const checkbox = screen.getByRole('checkbox', {
    name: 'Select all rules on this page',
  }) as HTMLInputElement;

  expect(checkbox.disabled).toBe(true);
});
