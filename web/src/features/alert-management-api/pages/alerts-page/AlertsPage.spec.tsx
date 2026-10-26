/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { AlertManagementAlertsPage } from '@/features/alert-management-api/pages/alerts-page/AlertsPage';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import { DataTestIDs } from '@/shared/constants/data-test';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  AlertSeverity: { Critical: 'critical', Warning: 'warning', Info: 'info', None: 'none' },
  AlertStates: { Firing: 'firing', Pending: 'pending', Silenced: 'silenced' },
  DocumentTitle: () => null,
  Timestamp: () => null,
  ListPageHeader: ({ title, children }: { title: string; children?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
  ResourceIcon: ({ kind }: { kind: string }) => <span>{kind}</span>,
}));

vi.mock('@/features/alert-management-api/hooks/useAlertManagementData', () => ({
  useAlertManagementData: () => ({
    data: { alerts: testAlerts },
    rulesQuery: {
      data: {},
      isLoading: false,
      isError: false,
      isFetching: false,
      dataUpdatedAt: 0,
      refetch: vi.fn(),
    },
    silencesQuery: { isError: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn() },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key === '{{group}}: {{value}} ({{count}} alerts)' && values?.count === 1) {
        key = '{{group}}: {{value}} ({{count}} alert)';
      }
      const text = key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(values?.[name] ?? name),
      );
      return values?.count && Number(values.count) !== 1
        ? text
            .replace(/ second$/, ' seconds')
            .replace(/ minute$/, ' minutes')
            .replace(/ hour$/, ' hours')
            .replace(/ day$/, ' days')
            .replace(/ week$/, ' weeks')
        : text;
    },
  }),
}));

const Query = () => {
  const { search } = useLocation();
  return <output data-testid={DataTestIDs.AlertManagementAPI.QueryOutput}>{search}</output>;
};

const queryParams = () =>
  new URLSearchParams(screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent);

const alertNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent?.match(/Alert\d/)?.[0]);

const AlertsPage = () => (
  <QueryParamProvider adapter={ReactRouter7Adapter}>
    <AlertManagementAlertsPage />
  </QueryParamProvider>
);

it('sorts from each column header and saves column and direction in the URL', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?refreshInterval=30s']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  expect(alertNames(), 'Alerts should start in the default name order').toEqual([
    'Alert1',
    'Alert3',
    'Alert4',
    'Alert5',
    'Alert1',
  ]);
  for (const heading of [
    'Alert name',
    'Severity',
    'Total',
    'State',
    'Alert scope',
    'Affected component',
    'Source',
  ]) {
    expect(
      screen.getByRole('button', { name: heading }),
      `${heading} should be sortable`,
    ).toBeDefined();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Alert name' }));
  expect(alertNames(), 'First name sort should order alerts ascending').toEqual([
    'Alert1',
    'Alert1',
    'Alert3',
    'Alert4',
    'Alert5',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Alert name' }));
  expect(alertNames(), 'Second name sort should order alerts descending').toEqual([
    'Alert5',
    'Alert4',
    'Alert3',
    'Alert1',
    'Alert1',
  ]);
  expect(
    screen.getByRole('columnheader', { name: 'Alert name' }).getAttribute('aria-sort'),
    'Descending name sort should be exposed to assistive technology',
  ).toBe('descending');
  const params = queryParams();
  expect(params.get('sort'), 'The URL should retain the selected sort column').toBe('name');
  expect(params.get('sortDirection'), 'The URL should record descending sort direction').toBe(
    'desc',
  );
  expect(
    params.get('refreshInterval'),
    'Sorting should preserve the refresh interval URL parameter',
  ).toBe('30s');
  fireEvent.click(screen.getByRole('button', { name: 'Severity' }));
  expect(alertNames(), 'Selecting another sortable column should sort by severity').toEqual([
    'Alert1',
    'Alert3',
    'Alert4',
    'Alert5',
    'Alert1',
  ]);
  expect(
    queryParams().has('sort'),
    'The URL should clear sorting when severity uses its default order',
  ).toBe(false);
});

it.each(['Manage columns', 'Export as CSV'])('shows the %s tooltip', async (label) => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts']}>
      <AlertsPage />
    </MemoryRouter>,
  );

  fireEvent.mouseEnter(screen.getByRole('button', { name: label }));
  expect((await screen.findByRole('tooltip')).textContent).toBe(label);
});

it('manages optional table columns while keeping alert name and severity visible', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts']}>
      <AlertsPage />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('button', { name: 'Export as CSV' }),
    'CSV export should be available',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Manage columns' }));
  expect(
    screen.getByRole('heading', { name: 'Manage columns' }),
    'The column manager should open',
  ).toBeDefined();
  expect(
    (document.getElementById(DataTestIDs.AlertManagementAPI.ColumnNameCheckbox) as HTMLInputElement)
      .disabled,
    'Alert name should remain a required column',
  ).toBe(true);
  expect(
    (
      document.getElementById(
        DataTestIDs.AlertManagementAPI.ColumnSeverityCheckbox,
      ) as HTMLInputElement
    ).disabled,
    'Severity should remain a required column',
  ).toBe(true);
  fireEvent.click(
    document.getElementById(`${DataTestIDs.AlertManagementAPI.ColumnCheckboxPrefix}-source`)!,
  );
  fireEvent.click(
    document.getElementById(`${DataTestIDs.AlertManagementAPI.ColumnCheckboxPrefix}-description`)!,
  );
  fireEvent.click(
    document.getElementById(`${DataTestIDs.AlertManagementAPI.ColumnCheckboxPrefix}-namespace`)!,
  );
  fireEvent.click(
    document.getElementById(`${DataTestIDs.AlertManagementAPI.ColumnCheckboxPrefix}-resource`)!,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(
    screen.getByRole('columnheader', { name: 'Alert name' }),
    'Alert name should remain visible',
  ).toBeDefined();
  expect(
    screen.getByRole('columnheader', { name: 'Severity' }),
    'Severity should remain visible',
  ).toBeDefined();
  expect(
    screen.getByRole('columnheader', { name: 'Description (in alert)' }),
    'The selected description column should be visible',
  ).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Namespace (in alert)' })).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Resource (in alert)' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Namespace (in alert)' }));
  expect(
    screen.getByRole('columnheader', { name: 'Namespace (in alert)' }).getAttribute('aria-sort'),
  ).toBe('ascending');
  expect(
    screen.queryByRole('columnheader', { name: 'Source' }),
    'The deselected source column should be hidden',
  ).toBeNull();
});

it('restores aggregation from the URL and removes the parameter when re-enabled', () => {
  const { unmount } = render(
    <MemoryRouter
      initialEntries={[
        '/monitoring/v2/alerts?page=2&perPage=2&refreshInterval=30s&sort=total&sortDirection=desc',
      ]}
    >
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  const aggregationSwitch = screen.getByRole('switch', { name: 'Aggregate identical alerts' });
  expect((aggregationSwitch as HTMLInputElement).checked).toBe(true);
  fireEvent.click(aggregationSwitch);
  expect((aggregationSwitch as HTMLInputElement).checked).toBe(false);
  expect(queryParams().get('aggregate')).toBe('0');
  expect(queryParams().get('page')).toBe('1');
  expect(queryParams().get('refreshInterval')).toBe('30s');
  expect(queryParams().has('sort')).toBe(false);
  expect(queryParams().has('sortDirection')).toBe(false);
  const search = screen.getByTestId(DataTestIDs.AlertManagementAPI.QueryOutput).textContent;

  unmount();
  render(
    <MemoryRouter initialEntries={[`/monitoring/v2/alerts${search}`]}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  const restoredSwitch = screen.getByRole('switch', { name: 'Aggregate identical alerts' });
  expect((restoredSwitch as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole('columnheader', { name: 'Total' })).toBeNull();
  expect(alertNames()).toHaveLength(2);
  fireEvent.click(restoredSwitch);
  expect((restoredSwitch as HTMLInputElement).checked).toBe(true);
  expect(queryParams().has('aggregate')).toBe(false);
  expect(screen.getByRole('columnheader', { name: 'Total' })).toBeDefined();
});

it('displays selected filter chips and clears them individually', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Filter critical alerts' }));
  expect(
    within(screen.getByRole('list', { name: 'Severity' })).getByText('Critical'),
    'The selected severity should appear in its filter chip',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Remove filter' }));
  expect(
    screen.queryByRole('list', { name: 'Severity' }),
    'Removing the chip should clear the severity filter display',
  ).toBeNull();
  expect(
    queryParams().has('severity'),
    'Removing the chip should clear the severity URL parameter',
  ).toBe(false);
});

it('resets pagination when filters change without dropping other URL state', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?page=2&perPage=2&refreshInterval=30s']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  expect(alertNames(), 'The initial second page should show its two alerts').toEqual([
    'Alert4',
    'Alert5',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Filter critical alerts' }));

  expect(
    alertNames(),
    'Applying the filter should reset pagination and show matching alerts',
  ).toEqual(['Alert1', 'Alert3']);
  expect(
    Object.fromEntries(queryParams()),
    'Filtering should reset page while preserving other URL state',
  ).toEqual({
    page: '1',
    perPage: '2',
    refreshInterval: '30s',
    severity: 'critical',
  });
});

it('clears selected filters and firing-time query state', () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/monitoring/v2/alerts?severity=critical&name=Alert1&timeRange=3600000&endTime=1790000000000',
      ]}
    >
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

  expect(
    queryParams().has('severity'),
    'Clearing filters should remove the severity URL parameter',
  ).toBe(false);
  expect(queryParams().has('name'), 'Clearing filters should remove the name URL parameter').toBe(
    false,
  );
  expect(
    queryParams().has('timeRange'),
    'Clearing filters should remove the firing-time range',
  ).toBe(false);
  expect(queryParams().has('endTime'), 'Clearing filters should remove the firing-time end').toBe(
    false,
  );
});

it.each([
  ['severity', 'Severity', 'Severity: Critical (5 alerts)'],
  ['scope', 'Alert scope', 'Alert scope: Cluster (4 alerts)'],
  ['component', 'Component', 'Component: component (6 alerts)'],
])(
  'restores %s grouping from the URL with groups closed and aggregates collapsed',
  (value, label, summary) => {
    render(
      <MemoryRouter initialEntries={[`/monitoring/v2/alerts?groupBy=${value}`]}>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: 'Group by' }).textContent,
      'The grouping should be restored from the URL',
    ).toContain(label);
    const groupRow = screen.getByRole('cell', { name: summary }).closest('tr')!;
    expect(
      within(groupRow).getByRole('button').getAttribute('aria-expanded'),
      'Restored groups should start collapsed',
    ).toBe('false');
    expect(
      screen.queryByRole('checkbox', { name: /^Select Alert\d alerts$/ }),
      'Restored collapsed groups should hide alert selections',
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all groups on this page' }));
    expect(
      screen.getAllByRole('checkbox', { name: /^Select Alert\d alerts$/ }),
      'Expanding restored groups should reveal all five aggregates',
    ).toHaveLength(5);
    expect(
      screen.queryByRole('link', { name: /^Alert\d$/ }),
      'Expanded aggregate rows should remain collapsed individually',
    ).toBeNull();
  },
);

it('falls back to a flat table for an invalid URL grouping', () => {
  render(
    <MemoryRouter
      initialEntries={['/monitoring/v2/alerts?groupBy=invalid&sort=name&sortDirection=desc']}
    >
      <AlertsPage />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('button', { name: 'Group by' }).textContent,
    'An invalid groupBy value should fall back to no grouping',
  ).toContain('None');
  expect(alertNames(), 'Invalid grouping should preserve the requested descending sort').toEqual([
    'Alert5',
    'Alert4',
    'Alert3',
    'Alert1',
    'Alert1',
  ]);
  expect(
    screen.queryByRole('button', { name: 'Expand all groups on this page' }),
    'Ungrouped fallback should hide expand-all controls',
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Collapse all groups on this page' }),
    'Ungrouped fallback should hide collapse-all controls',
  ).toBeNull();
});

it('limits group collapse and expansion to the current page', () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?groupBy=scope&perPage=3']}>
      <AlertsPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Expand all groups on this page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all groups on this page' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
  expect(
    screen.queryByRole('checkbox', { name: /^Select Alert\d alerts$/ }),
    'A newly selected page should start with its groups collapsed',
  ).toBeNull();
  screen.getAllByRole('button', { name: /^Toggle group:/ }).forEach((button) => {
    expect(
      button.getAttribute('aria-expanded'),
      'Groups on the new page should remain collapsed',
    ).toBe('false');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Expand all groups on this page' }));
  expect(
    screen.getByRole('checkbox', { name: 'Select Alert4 alerts' }),
    'Expanding the current page should show Alert4',
  ).toBeDefined();
  expect(
    screen.getByRole('checkbox', { name: 'Select Alert5 alerts' }),
    'Expanding the current page should show Alert5',
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all groups on this page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Expand all groups on this page' }));
  expect(
    screen.getByRole('checkbox', { name: 'Select Alert4 alerts' }),
    'Repeated group toggles should keep current-page groups available',
  ).toBeDefined();

  fireEvent.click(screen.getAllByRole('button', { name: 'Go to previous page' })[0]);
  expect(
    screen.queryByRole('checkbox', { name: /^Select Alert\d alerts$/ }),
    'Returning to the previous page should start with its groups collapsed',
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Expand all groups on this page' }));
  expect(
    screen.getAllByRole('checkbox', { name: 'Select Alert1 alerts' }),
    'Expanding the previous page should show both Alert1 groups',
  ).toHaveLength(2);
  expect(
    screen.getByRole('checkbox', { name: 'Select Alert3 alerts' }),
    'Expanding the previous page should show Alert3',
  ).toBeDefined();
});

it('exports all filtered aggregates across pages and collapsed groups without group summaries', async () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:alerts');
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    },
  );
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  try {
    render(
      <MemoryRouter initialEntries={['/monitoring/v2/alerts?groupBy=scope&perPage=2&state=firing']}>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(
      screen.getAllByRole('button', { name: /^Toggle group:/ }),
      'The current page should show its single group control',
    ).toHaveLength(1);
    screen.getAllByRole('button', { name: /^Toggle group:/ }).forEach((button) => {
      expect(button.getAttribute('aria-expanded'), 'Groups should be collapsed before export').toBe(
        'false',
      );
    });
    expect(
      screen.queryByRole('checkbox', { name: /^Select Alert\d alerts$/ }),
      'Collapsed groups should hide individual selections before export',
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));

    expect(
      createObjectURL,
      'CSV export should create one downloadable object URL',
    ).toHaveBeenCalledTimes(1);
    expect(click, 'CSV export should click its download link once').toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type, 'The export blob should use the CSV content type').toBe('text/csv');
    let csv = '';
    await act(async () => {
      csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    });
    const rows = csv.trim().split('\n');
    expect(rows[0]).toContain(`"'Namespace (in alert)"`);
    expect(rows[0]).toContain(`"'Resource (in alert)"`);
    expect(csv).toContain(`"'openshift-monitoring"`);
    expect(
      rows,
      'The CSV should contain a header and all five filtered alert aggregates',
    ).toHaveLength(6);
    expect(
      rows
        .slice(1)
        .map((row) => row.split(',')[0])
        .sort(),
      'The CSV should export every filtered aggregate across pages',
    ).toEqual([`"'Alert1"`, `"'Alert1"`, `"'Alert3"`, `"'Alert4"`, `"'Alert5"`]);
    expect(
      rows.filter((row) => row.startsWith(`"'Alert1",`)).map((row) => row.split(',')[2]),
      'The CSV should preserve the individual totals for duplicate alert aggregates',
    ).toEqual([`"'2"`, `"'1"`]);
    expect(csv, 'The CSV should not include group summary rows').not.toContain('Alert scope:');
    expect(csv, 'The CSV should not include group alert-count summaries').not.toMatch(
      /\(\d+ alerts?\)/,
    );
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('clears firing-time URL state and restores alerts when Any time is selected', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?refreshInterval=30s']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Any time' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Last 6 hours' })));
  expect(
    queryParams().get('timeRange'),
    'Selecting Last 6 hours should set the millisecond range URL parameter',
  ).toBe(String(6 * 60 * 60 * 1000));

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 6 hours' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Any time' })));
  expect(
    queryParams().has('timeRange'),
    'Selecting Any time should clear the range URL parameter',
  ).toBe(false);
  expect(
    queryParams().has('endTime'),
    'Selecting Any time should clear the range end URL parameter',
  ).toBe(false);
  expect(alertNames(), 'Selecting Any time should restore all five alert aggregates').toHaveLength(
    5,
  );
});

it('resets pagination when the time range changes', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?page=2&perPage=2']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Any time' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Last 6 hours' })));

  expect(
    queryParams().get('page'),
    'Changing the time range should reset pagination to the first page',
  ).toBe('1');
  expect(
    queryParams().get('perPage'),
    'Changing the time range should preserve the page size',
  ).toBe('2');
  expect(
    queryParams().get('timeRange'),
    'Changing the time range should update the URL range',
  ).toBe(String(6 * 60 * 60 * 1000));
});

it('selects a firing-time preset and a validated custom range from the toolbar', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring/v2/alerts?refreshInterval=30s']}>
      <AlertsPage />
      <Query />
    </MemoryRouter>,
  );

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Any time' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Last 6 hours' })));
  expect(
    queryParams().get('timeRange'),
    'Selecting the preset should set its millisecond URL range',
  ).toBe(String(6 * 60 * 60 * 1000));

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 6 hours' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Custom time range' })));
  const from = document.getElementById(
    DataTestIDs.TimeRangeSelect.CustomRangeFromInput,
  ) as HTMLInputElement;
  const to = document.getElementById(
    DataTestIDs.TimeRangeSelect.CustomRangeToInput,
  ) as HTMLInputElement;
  fireEvent.change(from, { target: { value: '2026-09-29' } });
  fireEvent.change(to, { target: { value: '2026-09-28' } });
  expect(
    screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled'),
    'A custom range ending before it starts should not be saveable',
  ).toBe('true');
  fireEvent.change(to, { target: { value: '2026-09-30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  const params = queryParams();
  expect(
    Number(params.get('timeRange')),
    'Saving a valid custom range should store a positive duration',
  ).toBeGreaterThan(0);
  expect(
    Number(params.get('endTime')),
    'Saving a valid custom range should store its end timestamp',
  ).toBeGreaterThan(0);
  expect(
    params.has('firingTime'),
    'The custom range URL should not retain the legacy firingTime parameter',
  ).toBe(false);
  expect(
    params.get('refreshInterval'),
    'Selecting a custom range should preserve the refresh interval',
  ).toBe('30s');
});
