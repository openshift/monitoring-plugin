/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import { useAlertManagementSort } from '@/features/alert-management-api/hooks/useAlertManagementSort';
import { useAlertManagementFilters } from '@/features/alert-management-api/pages/alerts-page/hooks/useAlertFilters';
import { defaultAlertSort, sortColumns } from '@/features/alert-management-api/utils/sort-alerts';
import { defaultRuleSort, RuleSort } from '@/features/alert-management-api/utils/sort-rules';
import { DataTestIDs } from '@/shared/constants/data-test';

const SortControls = () => {
  const { search } = useLocation();
  const { filters, setFilters } = useAlertManagementFilters();
  const { sort, setSort } = useAlertManagementSort(sortColumns, defaultAlertSort);
  return (
    <>
      <output data-testid={DataTestIDs.AlertManagementAPI.SortOutput}>
        {`${sort.column}:${sort.direction}`}
      </output>
      <output data-testid={DataTestIDs.AlertManagementAPI.QueryOutput}>{search}</output>
      <button onClick={() => setSort({ column: 'total', direction: 'asc' })}>Total</button>
      <button onClick={() => setSort(defaultAlertSort)}>Default</button>
      <button onClick={() => setFilters({ ...filters, name: 'HighCPU' })}>Filter</button>
    </>
  );
};

const RuleSortControls = ({ defaultSort = defaultRuleSort }: { defaultSort?: RuleSort }) => {
  const { search } = useLocation();
  const { sort, setSort } = useAlertManagementSort(
    ['name', 'enablement', 'namespace', 'managedBy'] as const,
    defaultSort,
  );
  return (
    <>
      <output data-testid={DataTestIDs.AlertManagementAPI.SortOutput}>
        {`${sort.column}:${sort.direction}`}
      </output>
      <output data-testid={DataTestIDs.AlertManagementAPI.QueryOutput}>{search}</output>
      <button onClick={() => setSort({ column: 'namespace', direction: 'asc' })}>Namespace</button>
      <button onClick={() => setSort(defaultSort)}>Default</button>
    </>
  );
};

it('restores sorting and preserves filters and refresh settings when sorting', () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/monitoring/v2/alerts?sort=name&sortDirection=desc&severity=critical&refreshInterval=30s',
      ]}
    >
      <SortControls />
    </MemoryRouter>,
  );

  expect(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent,
    'the sort from the URL should be restored',
  ).toBe('name:desc');
  fireEvent.click(screen.getByRole('button', { name: 'Total' }));
  const params = new URLSearchParams(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent,
  );
  expect(params.get('sort'), 'the selected sort column should be written to the URL').toBe('total');
  expect(
    params.get('sortDirection'),
    'the selected sort direction should be written to the URL',
  ).toBe('asc');
  expect(params.get('severity'), 'sorting should preserve the severity filter').toBe('critical');
  expect(params.get('refreshInterval'), 'sorting should preserve the refresh interval').toBe('30s');
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  expect(
    new URLSearchParams(
      screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent,
    ).get('sort'),
    'changing filters should preserve the selected sort column',
  ).toBe('total');

  fireEvent.click(screen.getByRole('button', { name: 'Default' }));
  expect(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent,
    'resetting sort should restore the default column and direction',
  ).toBe('severity:asc');
  const paramsAfterReset = new URLSearchParams(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent,
  );
  expect(paramsAfterReset.has('sort'), 'the default sort should be omitted from the URL').toBe(
    false,
  );
  expect(
    paramsAfterReset.get('severity'),
    'resetting sort should preserve the severity filter',
  ).toBe('critical');
});

it('ignores unknown sort columns and directions', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?sort=unknown&sortDirection=sideways']}>
      <SortControls />
    </MemoryRouter>,
  );

  expect(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent,
    'unknown sort values should fall back to the default sort',
  ).toBe('severity:asc');
});

it('supports rule columns and defaults while preserving unrelated URL parameters', () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/monitoring/v2/management/alertrules?sort=managedBy&sortDirection=desc&page=3&enablement=Enabled&refreshInterval=30000',
      ]}
    >
      <RuleSortControls />
    </MemoryRouter>,
  );
  expect(screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent).toBe(
    'managedBy:desc',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
  const params = new URLSearchParams(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent!,
  );
  expect(params.get('sort')).toBe('namespace');
  expect(params.get('sortDirection')).toBe('asc');
  expect(params.get('page')).toBe('1');
  expect(params.get('enablement')).toBe('Enabled');
  expect(params.get('refreshInterval')).toBe('30000');

  fireEvent.click(screen.getByRole('button', { name: 'Default' }));
  expect(screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent).toBe(
    'name:asc',
  );
  const resetParams = new URLSearchParams(
    screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent!,
  );
  expect(resetParams.has('sort')).toBe(false);
  expect(resetParams.has('sortDirection')).toBe(false);
  expect(resetParams.get('page')).toBe('1');
  expect(resetParams.get('enablement')).toBe('Enabled');
});

it.each(['', '?sort=total&sortDirection=sideways'])(
  'uses configured defaults, including descending direction, for invalid or missing values: %s',
  (search) => {
    render(
      <MemoryRouter initialEntries={[`/monitoring/v2/management/alertrules${search}`]}>
        <RuleSortControls defaultSort={{ column: 'namespace', direction: 'desc' }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId(DataTestIDs.AlertManagementAPI.SortOutput).textContent).toBe(
      'namespace:desc',
    );
  },
);
