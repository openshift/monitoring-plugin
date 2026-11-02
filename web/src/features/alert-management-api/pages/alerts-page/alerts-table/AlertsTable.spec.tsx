/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { MemoryRouter } from 'react-router';

import { AlertsTable } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertsTable';
import type { AlertsTableRef } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertsTable';
import {
  alertColumns,
  defaultAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import {
  AlertGroupBy,
  groupAlerts,
} from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import { aggregateAlerts, getAlertStableKey } from '@/features/alert-management-api/utils/alerts';
import { defaultAlertSort } from '@/features/alert-management-api/utils/sort-alerts';
import { DataTestIDs } from '@/shared/constants/data-test';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key === '{{group}}: {{value}} ({{count}} alerts)' && values?.count === 1) {
        key = '{{group}}: {{value}} ({{count}} alert)';
      }
      return key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(values?.[name] ?? name),
      );
    },
  }),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  ResourceIcon: ({ kind }: { kind: string }) => (
    <span data-testid={DataTestIDs.AlertResourceIcon}>{kind}</span>
  ),
  Timestamp: () => null,
}));

const rows = aggregateAlerts(testAlerts);
const groups = groupAlerts(testAlerts, AlertGroupBy.Scope, true, defaultAlertSort);

const table = (props: Partial<ComponentPropsWithRef<typeof AlertsTable>> = {}) => (
  <MemoryRouter>
    <AlertsTable
      aggregatedAlerts={rows}
      pageGroups={groups}
      groupBy={AlertGroupBy.Scope}
      isAggregated
      sort={defaultAlertSort}
      onSort={vi.fn()}
      selectedAlertKeys={new Set()}
      onSelectionChange={vi.fn()}
      {...props}
    />
  </MemoryRouter>
);

it.each([true, false])(
  'aligns reordered group and alert cells with aggregation %s',
  (isAggregated) => {
    const onSort = vi.fn();
    render(
      table({
        isAggregated,
        pageGroups: groupAlerts(testAlerts, AlertGroupBy.Scope, isAggregated, defaultAlertSort),
        columns: ['source', 'total', 'severity', 'name'],
        onSort,
      }),
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers.slice(2, -1).map((header) => header.textContent)).toEqual(
      isAggregated
        ? ['Source', 'Total', 'Severity', 'Alert name']
        : ['Source', 'Severity', 'Alert name'],
    );
    expect(
      screen
        .getByRole('columnheader', { name: 'Alert name' })
        .classList.contains('pf-v6-c-table__sticky-cell'),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(onSort).toHaveBeenCalledWith({ column: 'source', direction: 'asc' });
    const summary = screen.getByText('Alert scope: Cluster (4 alerts)').closest('tr')!;
    const cells = within(summary).getAllByRole('cell');
    expect(cells[2].textContent).toBe('');
    expect(cells[isAggregated ? 5 : 4].textContent).toContain('Alert scope: Cluster');
    fireEvent.click(within(summary).getByRole('button'));
    if (isAggregated) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    }
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(within(row).getAllByRole('cell')).toHaveLength(headers.length);
    }
  },
);

it('expands an ungrouped aggregate into its individual rows', () => {
  render(
    table({
      aggregatedAlerts: aggregateAlerts(testAlerts.slice(0, 2)),
      pageGroups: [],
      groupBy: AlertGroupBy.None,
    }),
  );

  expect(
    screen.getByRole('region', { name: 'Alerts table scroll area' }),
    'The alerts table should be contained in a labeled scroll region',
  ).toBeDefined();
  for (const column of ['Severity', 'Alert scope', 'Affected component', 'Source']) {
    expect(
      screen.getByRole('button', { name: `More about ${column}` }),
      `The ${column} column should provide additional information`,
    ).toBeDefined();
  }
  const header = screen.getByRole('columnheader', { name: 'Alert name' });
  expect(
    header.classList.contains('pf-v6-c-table__sticky-cell'),
    'The alert name header should remain sticky while scrolling',
  ).toBe(true);
  expect(
    header.classList.contains('pf-m-fit-content'),
    'The alert name header should have enough width for its content',
  ).toBe(false);
  expect(
    screen
      .getByRole('columnheader', { name: 'Affected component' })
      .classList.contains('pf-m-fit-content'),
    'The affected component header should have enough width for its content',
  ).toBe(false);
  expect(
    header.style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart'),
    'The alert name header should be offset past the selection and expand controls',
  ).toBe('5rem');
  expect(
    screen.getAllByText('Alert1'),
    'One collapsed aggregate row should show Alert1 once',
  ).toHaveLength(1);
  expect(
    screen.getAllByTestId(DataTestIDs.AlertResourceIcon).map((icon) => icon.textContent),
    'Each rendered alert row should show its alert resource icon',
  ).toEqual(['Alert']);
  const aggregateRow = screen.getByText('Alert1').closest('tr')!;
  expect(
    within(aggregateRow).getByRole('cell', { name: 'User' }),
    'The Alert1 aggregate row should show its source',
  ).toBeDefined();
  expect(
    within(aggregateRow).getByRole('cell', { name: /Firing/ }),
    'The Alert1 aggregate row should show its firing state',
  ).toBeDefined();
  const expandButton = screen.getByRole('button', { name: 'Details' });
  expect(
    expandButton.id.startsWith(DataTestIDs.AlertManagementAPI.ExpandRowPrefix),
    'The aggregate details button should use the alert row expand ID prefix',
  ).toBe(true);
  expect(
    expandButton.getAttribute('aria-expanded'),
    'Aggregate details should be collapsed before the button is clicked',
  ).toBe('false');
  fireEvent.click(expandButton);
  expect(
    expandButton.getAttribute('aria-expanded'),
    'Clicking the details button should expand the aggregate',
  ).toBe('true');
  expect(
    screen.getAllByText('Alert1'),
    'Expanding the aggregate should reveal its three alert rows',
  ).toHaveLength(3);
  screen.getAllByText('Alert1').forEach((name) => {
    expect(
      name.closest('td')?.classList.contains('pf-v6-c-table__sticky-cell'),
      'Each expanded alert name cell should remain sticky',
    ).toBe(true);
  });
  expect(
    screen.getAllByTestId(DataTestIDs.AlertResourceIcon).map((icon) => icon.textContent),
    'Each expanded alert row should show its alert resource icon',
  ).toEqual(['Alert', 'Alert', 'Alert']);
  const expandedRows = within(aggregateRow.closest('tbody')!).getAllByRole('row');
  expect(expandedRows, 'The expanded Alert1 aggregate should show its two alert rows').toHaveLength(
    3,
  );
  expandedRows.forEach((row) => {
    expect(
      within(row).getByRole('cell', { name: 'User' }),
      'Each row in the expanded Alert1 aggregate should show its source',
    ).toBeDefined();
    expect(
      within(row).getByRole('cell', { name: /Firing/ }),
      'Each row in the expanded Alert1 aggregate should show its firing state',
    ).toBeDefined();
  });
});

it('derives group counts from rows in aligned sibling bodies with optional columns', () => {
  const { container } = render(table({ columns: alertColumns.map(({ key }) => key) }));
  expect(
    container.querySelectorAll('table > tbody'),
    'Grouped rows should render in two sibling table bodies',
  ).toHaveLength(2);
  expect(
    container.querySelector('tbody tbody'),
    'Grouped table bodies should not be nested',
  ).toBeNull();
  const summary = screen.getByText('Alert scope: Cluster (4 alerts)').closest('tr')!;
  const cells = within(summary).getAllByRole('cell');
  expect(cells[1].textContent, 'The group summary should leave its selection column empty').toBe(
    '',
  );
  expect(
    within(summary).queryByRole('checkbox'),
    'Group summary rows should not have selection checkboxes',
  ).toBeNull();
  expect(
    cells[2].classList.contains('pf-v6-c-table__sticky-cell'),
    'The group summary label should remain sticky with the alert name column',
  ).toBe(true);
  expect(
    cells[2].getAttribute('colspan'),
    'The sticky summary label should occupy one cell',
  ).toBeNull();
  expect(
    cells[1].style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart'),
    'The summary row should offset its sticky label past the selection column',
  ).toBe('3rem');
  expect(
    screen.getByRole('button', { name: 'Toggle group: Alert scope: Cluster (4 alerts)' }),
    'Each group summary should provide a control to expand or collapse it',
  ).toBeDefined();
  expect(cells[3].textContent, 'The group summary should show the aggregate alert total').toBe(
    '21',
  );
  expect(
    cells[4].textContent,
    'The group summary should show the number of alerts in the group',
  ).toBe('4');
  const headers = screen.getAllByRole('columnheader');
  const columnCount = headers.length;
  headers.forEach((header, index) => {
    expect(
      header.classList.contains('pf-m-fit-content'),
      'Only the selection, alert name, and final detail columns should fit their content',
    ).toBe(index < 2 || index === columnCount - 1);
  });
  screen
    .getAllByRole('row')
    .slice(1)
    .forEach((row) => {
      expect(
        within(row)
          .getAllByRole('cell')
          .reduce((sum, cell) => sum + (cell as HTMLTableCellElement).colSpan, 0),
        'Every row should have cells spanning the same number of columns as the header',
      ).toBe(columnCount);
    });
  expect(
    screen.getByText('Alert scope: Namespace (2 alerts)'),
    'The namespace group summary should also be rendered',
  ).toBeDefined();
});

it('expands and collapses all groups through its ref', () => {
  const ref = createRef<AlertsTableRef>();
  render(table({ ref }));
  const groupToggles = screen.getAllByRole('button', { name: /^Toggle group:/ });
  expect(
    groupToggles.map((button) => button.getAttribute('aria-expanded')),
    'All groups should start collapsed',
  ).toEqual(['false', 'false']);

  act(() => ref.current?.expandAllGroups());
  expect(
    groupToggles.map((button) => button.getAttribute('aria-expanded')),
    'Expanding all groups should open every group',
  ).toEqual(['true', 'true']);

  act(() => ref.current?.collapseAllGroups());
  expect(
    groupToggles.map((button) => button.getAttribute('aria-expanded')),
    'Collapsing all groups should close every group',
  ).toEqual(['false', 'false']);
});

it('preserves aggregate expansion across group collapse and reordering', () => {
  const ref = createRef<AlertsTableRef>();
  const { rerender } = render(table({ ref }));
  act(() => ref.current?.expandAllGroups());
  fireEvent.click(
    within(
      screen.getAllByRole('checkbox', { name: 'Select Alert1 alerts' })[0].closest('tr')!,
    ).getByRole('button'),
  );
  expect(
    screen.getAllByRole('link', { name: rows[0].name }),
    'The expanded aggregate should show links for both alerts',
  ).toHaveLength(2);
  expect(
    screen.getAllByText('Since'),
    'The expanded aggregate should show a firing time for each alert',
  ).toHaveLength(rows[0].alerts.length);
  const groupToggle = within(
    screen.getByText('Alert scope: Cluster (4 alerts)').closest('tr')!,
  ).getByRole('button');
  expect(
    groupToggle.getAttribute('aria-expanded'),
    'The group should remain expanded before it is collapsed',
  ).toBe('true');
  fireEvent.click(groupToggle);
  expect(
    groupToggle.getAttribute('aria-expanded'),
    'Clicking the group control should collapse the group',
  ).toBe('false');
  expect(
    screen.queryByRole('link', { name: rows[0].name }),
    'Collapsing the group should hide its alert links',
  ).toBeNull();
  fireEvent.click(groupToggle);
  expect(
    screen.getAllByRole('link', { name: rows[0].name }),
    'Reopening the group should preserve the aggregate expansion',
  ).toHaveLength(2);
  const summaryCells = within(groupToggle.closest('tr')!).getAllByRole('cell');
  const headers = screen.getAllByRole('columnheader');
  [summaryCells[0], summaryCells[1], headers[0], headers[1]].forEach((cell) => {
    expect(
      cell.classList.contains('pf-m-fit-content'),
      'Group summary and leading header cells should fit their content',
    ).toBe(true);
  });
  rerender(
    table({ pageGroups: [...groups].reverse(), aggregatedAlerts: [...rows].reverse(), ref }),
  );
  expect(
    screen.getAllByRole('link', { name: rows[0].name }),
    'Reordering groups should preserve the expanded aggregate',
  ).toHaveLength(2);
  expect(
    screen.queryByRole('link', { name: rows[1].name }),
    'Reordering groups should not expand another aggregate',
  ).toBeNull();
});

it('shows alert state descriptions on individual rows', () => {
  render(
    table({
      aggregatedAlerts: groupAlerts(testAlerts, AlertGroupBy.None, false, defaultAlertSort)[0].rows,
      pageGroups: [],
      groupBy: AlertGroupBy.None,
      isAggregated: false,
    }),
  );

  expect(
    screen.getAllByText('Since'),
    'Each individual alert row should show its firing time',
  ).toHaveLength(testAlerts.length);
  const row = screen.getByText('Alert3').closest('tr')!;
  expect(
    within(row).queryByRole('button', { name: 'Details' }),
    'Individual alert rows should not have aggregate detail controls',
  ).toBeNull();
  expect(
    within(row).getByRole('link', { name: 'Alert3' }).getAttribute('href'),
    'Individual alert names should link to their sidepanel selection',
  ).toContain('alertRuleID=Alert3&alertID=');
  expect(
    within(row).getByRole('checkbox', { name: 'Select Alert3 alerts' }),
    'Each individual alert row should be selectable',
  ).toBeDefined();
  expect(row.cells, 'Each alert row should have one cell for every table column').toHaveLength(
    screen.getAllByRole('columnheader').length,
  );
  expect(
    screen
      .getByRole('columnheader', { name: 'Alert name' })
      .style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart'),
    'The alert name header should be offset only by the selection column when ungrouped',
  ).toBe('2rem');
  expect(
    screen.queryByRole('button', { name: 'Details' }),
    'Individual alert rows should not show aggregate detail controls',
  ).toBeNull();
  expect(
    screen.queryByRole('columnheader', { name: 'Total' }),
    'The total column should be hidden when alerts are not aggregated',
  ).toBeNull();
});

it('keeps the optional description column on a single line', () => {
  const description = 'This is a long alert description that should wrap within its column.';
  const alert = { ...testAlerts[0], annotations: { description } };
  render(
    table({
      aggregatedAlerts: aggregateAlerts([alert]),
      pageGroups: [],
      groupBy: AlertGroupBy.None,
      columns: [...defaultAlertColumns, 'description'],
    }),
  );

  const cell = screen.getByRole('cell', { name: description });
  expect(
    cell.classList.contains('pf-m-wrap'),
    'The optional description cell should not wrap onto multiple lines',
  ).toBe(false);
});

it.each([AlertGroupBy.Severity, AlertGroupBy.Scope, AlertGroupBy.Component])(
  'groups individual rows by %s without aggregate controls and selects collapsed rows',
  (groupBy) => {
    const pageGroups = groupAlerts(testAlerts, groupBy, false, defaultAlertSort);
    const ref = createRef<AlertsTableRef>();
    const onSelectionChange = vi.fn();
    const onSort = vi.fn();
    const { container } = render(
      table({
        groupBy,
        isAggregated: false,
        aggregatedAlerts: pageGroups.flatMap((group) => group.rows),
        pageGroups,
        columns: ['name', 'severity'],
        ref,
        onSelectionChange,
        onSort,
      }),
    );
    act(() => ref.current?.expandAllGroups());
    fireEvent.click(screen.getAllByRole('button', { name: /^Toggle group:/ })[0]);
    expect(
      screen.queryByRole('checkbox', { name: 'Select Alert3 alerts' }),
      'Collapsing a group should hide its individual selection controls',
    ).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all alerts on this page' }));
    expect(
      onSelectionChange,
      'Select-all should include every alert even when groups are collapsed',
    ).toHaveBeenCalledWith(new Set(testAlerts.map(getAlertStableKey)));
    fireEvent.click(screen.getAllByRole('button', { name: /^Toggle group:/ })[0]);
    expect(
      screen.queryByRole('columnheader', { name: 'Total' }),
      'The total column should be hidden for individual alert rows',
    ).toBeNull();
    const header = screen.getByRole('columnheader', { name: 'Alert name' });
    expect(
      header.style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart'),
      'Grouped alert names should be offset past selection and group controls',
    ).toBe('5rem');
    expect(
      screen.getByRole('columnheader', { name: /^Severity/ }).getAttribute('aria-sort'),
      'Sorting by severity should mark the severity header as ascending',
    ).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Alert name' }));
    expect(
      onSort,
      'Clicking the alert name header should request ascending name sorting',
    ).toHaveBeenCalledWith({ column: 'name', direction: 'asc' });
    const row = screen.getByText('Alert3').closest('tr')!;
    expect(
      row.cells[0].textContent,
      'A collapsed individual alert row should leave the group-control cell empty',
    ).toBe('');
    expect(
      row.cells,
      'The individual alert row should contain all five visible columns',
    ).toHaveLength(5);
    expect(
      within(row).queryByRole('button', { name: 'Details' }),
      'Individual alerts should not have aggregate detail buttons',
    ).toBeNull();
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size, 'Every rendered control ID should be unique').toBe(ids.length);
  },
);
