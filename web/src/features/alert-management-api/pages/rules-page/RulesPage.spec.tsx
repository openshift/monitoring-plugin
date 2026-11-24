/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router';

import { processAlertManagementData } from '@/features/alert-management-api/hooks/useAlertManagementData';
import { AlertRulesManagementPage } from '@/features/alert-management-api/pages/rules-page/RulesPage';
import {
  getMockAlertsResponse,
  getMockRulesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { RuleWithEnablement } from '@/features/alert-management-api/types/types';

const state = vi.hoisted(() => ({
  rules: [] as RuleWithEnablement[],
  loading: false,
  error: false,
  alertsLoading: false,
  alertsError: false,
  silencesLoading: false,
  silencesError: false,
  hasCachedData: false,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? name)),
  }),
}));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  ResourceIcon: () => <span>AR</span>,
}));
vi.mock('@/features/alert-management-api/hooks/useAlertManagementData', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/alert-management-api/hooks/useAlertManagementData')
  >()),
  useAlertManagementData: () => ({
    data:
      state.hasCachedData ||
      !(
        state.loading ||
        state.error ||
        state.alertsLoading ||
        state.alertsError ||
        state.silencesLoading
      )
        ? { rules: state.rules }
        : undefined,
    alertsQuery: {
      isLoading: state.alertsLoading,
      isError: state.alertsError,
      error: state.alertsError ? new Error('Alerts forbidden') : null,
    },
    silencesQuery: { isLoading: state.silencesLoading, isError: state.silencesError },
    rulesQuery: {
      isLoading: state.loading,
      isError: state.error,
      data: state.loading ? undefined : {},
      error: state.error ? new Error('Forbidden') : null,
    },
  }),
}));

const rules: RuleWithEnablement[] = processAlertManagementData(
  getMockRulesResponse(),
  getMockAlertsResponse(),
  { data: [], isLoading: false },
)!.rules;

function fixtureRule(name: string): RuleWithEnablement {
  const rule = rules.find((rule) => rule.name === name);
  if (!rule) {
    throw new Error(`Missing rule fixture: ${name}`);
  }
  return structuredClone(rule);
}

function Location() {
  return <output data-testid="query">{useLocation().search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/monitoring/v2/management/alertrules${search}`]}>
      <AlertRulesManagementPage />
      <Location />
    </MemoryRouter>,
  );
}

function renderPageWithHistory(search: string) {
  const path = '/monitoring/v2/management/alertrules';
  const router = createMemoryRouter(
    [
      {
        path,
        element: (
          <>
            <AlertRulesManagementPage />
            <Location />
          </>
        ),
      },
    ],
    { initialEntries: [`${path}?name=etcd`, `${path}${search}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

beforeEach(() => {
  state.rules = structuredClone(rules);
  state.loading = false;
  state.error = false;
  state.alertsLoading = false;
  state.alertsError = false;
  state.silencesLoading = false;
  state.silencesError = false;
  state.hasCachedData = false;
});

it('lists inactive rules, paginates, and does not add cluster fields or a details sidebar', () => {
  renderPage();

  expect(tableRows()).toHaveLength(20);
  expect(screen.getByText('AlertmanagerReceiversNotConfigured')).toBeDefined();
  expect(screen.getByText('WorkloadAvailability')).toBeDefined();
  expect(screen.queryByText('WorkloadVolumeFull')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: /Target clusters|Region/ })).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Namespace' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Managed by' })).toBeNull();

  fireEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
  expect(tableRows()).toHaveLength(5);
  expect(screen.getByText('WorkloadVolumeFull')).toBeDefined();
});

it('separates the filter toolbar from results without displaying selection counts', () => {
  renderPage();
  const toolbar = screen
    .getByRole('textbox', { name: 'Search by rule name' })
    .closest('.pf-v6-c-panel__main');

  expect(toolbar).not.toBeNull();
  expect(toolbar?.nextElementSibling?.tagName).toBe('HR');
  expect(screen.getByRole('button', { name: 'Actions' })).toBeDefined();
  expect(screen.queryByText(/\d+ selected/)).toBeNull();
});

it('restores URL filters and sort, and resets pagination when searching', () => {
  renderPage('?page=2&sort=name&sortDirection=desc&refreshInterval=30000');

  expect(screen.getByText('AlertmanagerReceiversNotConfigured')).toBeDefined();

  fireEvent.change(screen.getByRole('textbox', { name: 'Search by rule name' }), {
    target: { value: 'WORKLOADVOLUMEFULL' },
  });
  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('WorkloadVolumeFull')).toBeDefined();

  const params = new URLSearchParams(screen.getByTestId('query').textContent!);
  expect(params.get('page')).toBe('1');
  expect(params.get('refreshInterval')).toBe('30000');
  expect(params.get('sortDirection')).toBe('desc');
});

it('replaces history when typing or clearing the rule-name search', async () => {
  const router = renderPageWithHistory(
    '?page=2&sort=name&sortDirection=desc&refreshInterval=30000',
  );
  const search = screen.getByRole('textbox', { name: 'Search by rule name' });

  for (const name of ['W', 'Work', 'Workload']) {
    fireEvent.change(search, { target: { value: name } });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(new URLSearchParams(router.state.location.search).get('name')).toBe(name);
  }

  const params = new URLSearchParams(router.state.location.search);
  expect(params.get('page')).toBe('1');
  expect(params.get('sortDirection')).toBe('desc');
  expect(params.get('refreshInterval')).toBe('30000');

  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(router.state.historyAction).toBe('REPLACE');
  expect(new URLSearchParams(router.state.location.search).has('name')).toBe(false);
  expect((search as HTMLInputElement).value).toBe('');

  await act(async () => router.navigate(-1));
  expect(new URLSearchParams(router.state.location.search).get('name')).toBe('etcd');
  expect((search as HTMLInputElement).value).toBe('etcd');

  await act(async () => router.navigate(1));
  expect((search as HTMLInputElement).value).toBe('');
});

it('still creates history entries for discrete filter changes', async () => {
  const router = renderPageWithHistory('?severity=critical');

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(router.state.historyAction).toBe('PUSH');
  expect(new URLSearchParams(router.state.location.search).has('severity')).toBe(false);

  await act(async () => router.navigate(-1));
  expect(new URLSearchParams(router.state.location.search).get('severity')).toBe('critical');
});

it('shows chips from URL filters and clears them', () => {
  renderPage('?severity=critical&source=user');
  const toolbar = screen
    .getByRole('textbox', { name: 'Search by rule name' })
    .closest<HTMLElement>('.pf-v6-c-panel__main')!;

  expect(within(toolbar).getByText('Critical')).toBeDefined();
  expect(within(toolbar).queryByText('critical')).toBeNull();
  expect(tableRows()).toHaveLength(7);

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(tableRows()).toHaveLength(20);
  expect(screen.getByTestId('query').textContent).not.toContain('severity');
});

it('searches and selects rule labels, counts rules and resets pagination', async () => {
  renderPage('?page=2&sort=name&sortDirection=desc&refreshInterval=30000');
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Select labels' })));

  const search = screen.getByRole('textbox', { name: 'Search rule labels' });
  fireEvent.change(search, { target: { value: 'TEAM=' } });
  expect(screen.getByRole('checkbox', { name: 'team=platform (3)' })).toBeDefined();
  expect(screen.queryByRole('checkbox', { name: /environment=/ })).toBeNull();

  fireEvent.click(screen.getByRole('checkbox', { name: 'team=platform (3)' }));
  expect(tableRows()).toHaveLength(3);

  fireEvent.change(search, { target: { value: 'environment=' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'environment=production (13)' }));
  expect(tableRows()).toHaveLength(2);
  expect(tableRows()[0].textContent).toContain('ClusterNotUpgradeable');

  const params = new URLSearchParams(screen.getByTestId('query').textContent!);
  expect(params.getAll('labels')).toEqual(['team=platform', 'environment=production']);
  expect(params.get('page')).toBe('1');
  expect(params.get('sortDirection')).toBe('desc');
  expect(params.get('refreshInterval')).toBe('30000');
});

it('restores label chips from the URL and removes or clears them', () => {
  renderPage('?labels=team%3Dplatform&labels=environment%3Dproduction');

  expect(tableRows()).toHaveLength(2);
  expect(screen.getByText('team=platform')).toBeDefined();
  expect(screen.getByText('environment=production')).toBeDefined();

  fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]);
  expect(tableRows()).toHaveLength(13);
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).getAll('labels')).toEqual([
    'environment=production',
  ]);

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(tableRows()).toHaveLength(20);
  expect(screen.getByTestId('query').textContent).not.toContain('labels');
});

it('selects only the current page and indicates partial selection', () => {
  renderPage();
  const selectAll = screen.getByRole('checkbox', { name: 'Select all rules on this page' });

  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select AlertmanagerReceiversNotConfigured' }),
  );
  expect((selectAll as HTMLInputElement).indeterminate).toBe(true);

  fireEvent.click(selectAll);
  expect(
    screen.getAllByRole('checkbox').filter((checkbox) => (checkbox as HTMLInputElement).checked),
  ).toHaveLength(21);
  expect(screen.queryByText(/\d+ selected/)).toBeNull();

  fireEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
  expect(
    (screen.getByRole('checkbox', { name: 'Select WorkloadReplicaShortage' }) as HTMLInputElement)
      .checked,
  ).toBe(false);

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rules on this page' }));
  expect(
    screen.getAllByRole('checkbox').filter((checkbox) => (checkbox as HTMLInputElement).checked),
  ).toHaveLength(6);

  fireEvent.click(screen.getAllByRole('button', { name: 'Go to previous page' })[0]);
  expect(
    screen.getAllByRole('checkbox').filter((checkbox) => (checkbox as HTMLInputElement).checked),
  ).toHaveLength(21);
  expect(screen.getByRole('button', { name: 'Actions' })).toBeDefined();
  expect(screen.queryByText(/\d+ selected/)).toBeNull();
});

it('opens and closes the reusable filter panel', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  expect(screen.getByRole('heading', { name: 'Filter rules' })).toBeDefined();
  expect(
    within(document.getElementById('alert-rule-filters')!).getByRole('button', { name: 'State' }),
  ).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('heading', { name: 'Filter rules' })).toBeNull();
});

it('keeps long rule names and selection cells sticky without wrapping', () => {
  const name = 'LongAlertRuleNameThatMustRemainOnASingleLine';
  state.rules = [{ ...fixtureRule('WorkloadAvailability'), name }];

  renderPage();

  const region = screen.getByRole('region', { name: 'Alert rules table scroll area' });
  expect(region.tabIndex).toBe(0);
  expect(within(region).getByRole('table')).toBeDefined();

  const header = screen.getByRole('columnheader', { name: 'Alert rule name' });
  const nameCell = screen.getByText(name).closest('td')!;
  for (const cell of [header, nameCell]) {
    expect(cell.classList.contains('pf-v6-c-table__sticky-cell')).toBe(true);
    expect(cell.classList.contains('pf-m-nowrap')).toBe(true);
    expect(cell.style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart')).toBe(
      '2rem',
    );
  }

  const selectionHeader = screen
    .getByRole('checkbox', { name: 'Select all rules on this page' })
    .closest('th')!;
  const selectionCell = screen.getByRole('checkbox', { name: `Select ${name}` }).closest('td')!;
  for (const cell of [selectionHeader, selectionCell]) {
    expect(cell.classList.contains('pf-v6-c-table__sticky-cell')).toBe(true);
    expect(cell.style.getPropertyValue('--pf-v6-c-table__sticky-cell--InsetInlineStart')).toBe('0');
  }
});

it('restores visible columns from the URL and keeps cells and sorting aligned', () => {
  renderPage('?columns=%5B%22source%22%2C%22name%22%2C%22enablement%22%2C%22severity%22%5D');

  const headers = screen.getAllByRole('columnheader');
  expect(headers.map((header) => header.textContent)).toEqual([
    '',
    'Source',
    'Alert rule name',
    'State',
    'Severity',
    'Actions',
  ]);

  const cells = within(tableRows()[0]).getAllByRole('cell');
  expect(cells.slice(1, -1).map((cell) => cell.getAttribute('data-label'))).toEqual([
    'Source',
    'Alert rule name',
    'State',
    'Severity',
  ]);
  expect(cells[1].textContent).toBe('Platform');
  expect(cells[2].textContent).toContain('AlertmanagerReceiversNotConfigured');
  expect(cells[2].classList.contains('pf-v6-c-table__sticky-cell')).toBe(false);
  expect(cells[2].classList.contains('pf-m-nowrap')).toBe(true);
  expect(
    screen
      .getByRole('columnheader', { name: 'Alert rule name' })
      .classList.contains('pf-v6-c-table__sticky-cell'),
  ).toBe(false);
  expect(within(cells[3]).getByText('Enabled')).toBeDefined();
  expect(within(cells[3]).getByText('1 Silenced')).toBeDefined();
  expect(cells[4].textContent).toBe('Warning');

  fireEvent.click(
    within(screen.getByRole('columnheader', { name: 'Severity' })).getByRole('button', {
      name: 'Severity',
    }),
  );
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).get('sort')).toBe(
    'severity',
  );
});

it('filters rule namespaces and managers in the sidebar and resets pagination', async () => {
  renderPage('?page=2&sort=name&sortDirection=desc&refreshInterval=30000');
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  const panel = within(document.getElementById('alert-rule-filters')!);
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'Select namespaces' })));
  fireEvent.click(screen.getByRole('checkbox', { name: 'production (6)' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'openshift-monitoring (3)' }));
  expect(tableRows()).toHaveLength(9);

  fireEvent.click(panel.getByRole('button', { name: 'Select namespaces (2)' }));
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'Managed by' })));
  expect(screen.getByRole('checkbox', { name: 'Operator (3)' })).toBeDefined();
  expect(screen.getByRole('checkbox', { name: 'GitOps (22)' })).toBeDefined();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Operator (3)' }));
  expect(tableRows()).toHaveLength(3);
  expect(tableRows()[0].textContent).toContain('Watchdog');

  const params = new URLSearchParams(screen.getByTestId('query').textContent!);
  expect(params.getAll('namespace')).toEqual(['production', 'openshift-monitoring']);
  expect(params.getAll('managedBy')).toEqual(['operator']);
  expect(params.get('page')).toBe('1');
  expect(params.get('sortDirection')).toBe('desc');
  expect(params.get('refreshInterval')).toBe('30000');

  fireEvent.click(panel.getByRole('button', { name: 'Clear all filters' }));
  expect(tableRows()).toHaveLength(20);
  const cleared = new URLSearchParams(screen.getByTestId('query').textContent!);
  expect(cleared.has('namespace')).toBe(false);
  expect(cleared.has('managedBy')).toBe(false);
});

it('uses the shared searchable namespace filter and preserves multiple selections', async () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  const panel = within(document.getElementById('alert-rule-filters')!);
  expect(panel.getByText('Showing all namespaces')).toBeDefined();

  const toggle = panel.getByRole('button', { name: 'Select namespaces' });
  expect(toggle.querySelector('svg[aria-hidden]')).not.toBeNull();

  await act(async () => fireEvent.click(toggle));
  const search = screen.getByRole('textbox', { name: 'Search namespaces' });
  expect(search.getAttribute('placeholder')).toBe('Search namespaces...');

  fireEvent.change(search, { target: { value: 'PRODUCTION' } });
  expect(screen.getByRole('checkbox', { name: 'production (6)' })).toBeDefined();
  expect(screen.queryByRole('checkbox', { name: 'payments (6)' })).toBeNull();

  fireEvent.change(search, { target: { value: 'missing' } });
  expect(screen.getByText('No namespaces found')).toBeDefined();

  fireEvent.change(search, { target: { value: '' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'production (6)' }));
  expect(tableRows()).toHaveLength(6);
  expect(panel.getByRole('button', { name: 'production' })).toBeDefined();

  fireEvent.click(screen.getByRole('checkbox', { name: 'payments (6)' }));
  expect(tableRows()).toHaveLength(12);
  expect(panel.getByRole('button', { name: 'Select namespaces (2)' })).toBeDefined();
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).getAll('namespace')).toEqual(
    ['production', 'payments'],
  );

  fireEvent.click(screen.getByRole('checkbox', { name: 'production (6)' }));
  expect(tableRows()).toHaveLength(6);
  expect(panel.getByRole('button', { name: 'payments' })).toBeDefined();
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).getAll('namespace')).toEqual(
    ['payments'],
  );
});

it('restores namespace and manager filter chips from the URL and removes them', () => {
  renderPage('?namespace=payments&managedBy=gitops');

  expect(tableRows()).toHaveLength(6);
  expect(screen.getByText('payments')).toBeDefined();
  expect(screen.getByText('GitOps')).toBeDefined();

  fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]);
  expect(tableRows()).toHaveLength(20);
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).has('namespace')).toBe(
    false,
  );

  fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]);
  expect(tableRows()).toHaveLength(20);
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).has('managedBy')).toBe(
    false,
  );
});

it('renders missing rule metadata without substituting the alert namespace', () => {
  state.rules = [
    { ...fixtureRule('WorkloadAvailability'), labels: { namespace: 'alert-namespace' } },
  ];

  renderPage(
    '?columns=' +
      encodeURIComponent(
        JSON.stringify(['name', 'enablement', 'severity', 'namespace', 'managedBy']),
      ),
  );

  const cells = within(tableRows()[0]).getAllByRole('cell');
  expect(cells.find((cell) => cell.getAttribute('data-label') === 'Namespace')?.textContent).toBe(
    '-',
  );
  expect(cells.find((cell) => cell.getAttribute('data-label') === 'Managed by')?.textContent).toBe(
    'None',
  );
  expect(screen.queryByText('alert-namespace')).toBeNull();
});

it('restores State when URL columns omit it', () => {
  renderPage('?columns=' + encodeURIComponent(JSON.stringify(['name', 'severity', 'namespace'])));

  expect(screen.getByRole('columnheader', { name: 'State' })).toBeDefined();
});

it('logs each rule menu action without changing the rule', () => {
  const rule = fixtureRule('AlertmanagerReceiversNotConfigured');
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  renderPage();

  const actions = [
    ['Edit alert rule', 'edit'],
    ['Disable', 'disable'],
    ['Duplicate', 'duplicate'],
    ['Silence alert rule', 'silence'],
    ['Delete', 'delete'],
  ];
  for (const [label, key] of actions) {
    fireEvent.click(screen.getByRole('button', { name: `Actions for ${rule.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    expect(debug).toHaveBeenLastCalledWith(`Alert rule ${key}: ${rule.name}, id: ${rule.id}`);
    expect(screen.queryByRole('menu')).toBeNull();
  }

  expect(debug).toHaveBeenCalledTimes(actions.length);
  expect(screen.getByText(rule.name)).toBeDefined();
  expect(tableRows()).toHaveLength(20);

  debug.mockRestore();
});

it('shows state icons and orders the State filter as Enabled, Disabled, then Unknown', async () => {
  state.rules = [
    fixtureRule('WorkloadMemoryHigh'),
    { ...fixtureRule('WorkloadAvailability'), alertingRuleEnabled: undefined },
    fixtureRule('ServiceUnavailable'),
  ];

  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  const panel = within(document.getElementById('alert-rule-filters')!);
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'State' })));
  expect(screen.getAllByRole('checkbox', { name: /^(Enabled|Disabled|Unknown) \(/ })).toEqual([
    screen.getByRole('checkbox', { name: 'Enabled (1)' }),
    screen.getByRole('checkbox', { name: 'Disabled (1)' }),
    screen.getByRole('checkbox', { name: 'Unknown (1)' }),
  ]);

  for (const label of ['Enabled', 'Disabled', 'Unknown']) {
    const option = screen
      .getByRole('checkbox', { name: `${label} (1)` })
      .closest<HTMLElement>('[role="menuitem"]')!;
    expect(within(option).getByText(label).querySelector('svg')).not.toBeNull();
  }

  fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled (1)' }));
  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('ServiceUnavailable')).toBeDefined();
});

it('shows enabled and disabled states and restores the state filter', () => {
  renderPage('?enablement=Disabled');

  expect(tableRows()).toHaveLength(5);
  expect(screen.getByRole('columnheader', { name: 'State' })).toBeDefined();
  expect(within(tableRows()[0]).getByText('Disabled')).toBeDefined();
  expect(screen.queryByText('ClusterNotUpgradeable')).toBeNull();
  expect(screen.getByText('WorkloadMemoryHigh')).toBeDefined();
});

it('shows and filters firing rules while keeping Disable in their action menu', () => {
  const rule = fixtureRule('RepeatedRequestLatency');
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  renderPage('?alertStates=Firing');

  expect(tableRows()).toHaveLength(1);
  expect(within(tableRows()[0]).getByText('Enabled')).toBeDefined();
  expect(within(tableRows()[0]).getByText('3 Firing')).toBeDefined();
  expect(within(tableRows()[0]).getByText('3 Silenced')).toBeDefined();
  expect(screen.getByText(rule.name)).toBeDefined();
  expect(screen.queryByText('ServiceUnavailable')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: `Actions for ${rule.name}` }));
  expect(screen.queryByRole('menuitem', { name: 'Enable' })).toBeNull();

  fireEvent.click(screen.getByRole('menuitem', { name: 'Disable' }));
  expect(debug).toHaveBeenCalledWith(`Alert rule disable: ${rule.name}, id: ${rule.id}`);
  expect(within(tableRows()[0]).getByText('3 Firing')).toBeDefined();
  expect(within(tableRows()[0]).getByText('3 Silenced')).toBeDefined();

  debug.mockRestore();
});

it('offers Pending in the Alert states dropdown using the development fixtures', async () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  const panel = within(document.getElementById('alert-rule-filters')!);
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'Alert states' })));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Pending (1)' }));
  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('ClusterNotUpgradeable')).toBeDefined();
});

it('separates enablement from firing, silenced and pending alert state filters', async () => {
  state.rules = [
    fixtureRule('RepeatedRequestLatency'),
    fixtureRule('ServiceUnavailable'),
    fixtureRule('ClusterNotUpgradeable'),
    fixtureRule('WorkloadAvailability'),
    fixtureRule('WorkloadMemoryHigh'),
  ];

  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Open rule filters' }));
  const panel = within(document.getElementById('alert-rule-filters')!);
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'State' })));
  expect(screen.getByRole('checkbox', { name: 'Enabled (4)' })).toBeDefined();
  expect(screen.getByRole('checkbox', { name: 'Disabled (1)' })).toBeDefined();
  expect(screen.queryByRole('checkbox', { name: /^(Firing|Pending|Silenced) \(/ })).toBeNull();

  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'State' })));
  await act(async () => fireEvent.click(panel.getByRole('button', { name: 'Alert states' })));
  expect(screen.queryByRole('checkbox', { name: 'Enabled (4)' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Firing (1)' })).toBeDefined();
  expect(screen.getByRole('checkbox', { name: 'Silenced (2)' })).toBeDefined();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Pending (1)' }));
  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('ClusterNotUpgradeable')).toBeDefined();
  expect(
    new URLSearchParams(screen.getByTestId('query').textContent!).getAll('alertStates'),
  ).toEqual(['Pending']);

  fireEvent.click(screen.getByRole('checkbox', { name: 'Firing (1)' }));
  expect(tableRows()).toHaveLength(2);
  expect(screen.getByText('RepeatedRequestLatency')).toBeDefined();
  expect(screen.queryByText('ServiceUnavailable')).toBeNull();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Pending (1)' }));
  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('RepeatedRequestLatency')).toBeDefined();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Silenced (2)' }));
  expect(tableRows()).toHaveLength(2);
  expect(screen.getByText('ServiceUnavailable')).toBeDefined();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Firing (1)' }));
  expect(tableRows()).toHaveLength(2);
  expect(screen.queryByText('ClusterNotUpgradeable')).toBeNull();
  expect(screen.queryByText('WorkloadAvailability')).toBeNull();
  expect(screen.queryByText('WorkloadMemoryHigh')).toBeNull();
  expect(
    new URLSearchParams(screen.getByTestId('query').textContent!).getAll('alertStates'),
  ).toEqual(['Silenced']);
});

it.each([
  { alertState: 'Silenced', ruleName: 'ServiceUnavailable' },
  { alertState: 'Pending', ruleName: 'ClusterNotUpgradeable' },
])('restores the $alertState alert state filter from the URL', ({ alertState, ruleName }) => {
  state.rules = [fixtureRule(ruleName), fixtureRule('WorkloadAvailability')];

  renderPage(`?alertStates=${alertState}`);

  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText(ruleName)).toBeDefined();
  expect(screen.queryByText('WorkloadAvailability')).toBeNull();
  expect(screen.getByText('Alert states')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Remove filter' }));
  expect(tableRows()).toHaveLength(2);
  expect(screen.getByTestId('query').textContent).not.toContain('alertStates');
});

it('combines enablement and alert states from the URL and clears both filters', () => {
  renderPage('?enablement=Enabled&alertStates=Pending');

  expect(tableRows()).toHaveLength(1);
  expect(screen.getByText('ClusterNotUpgradeable')).toBeDefined();
  expect(screen.queryByText('WorkloadMemoryHigh')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(tableRows()).toHaveLength(20);
  expect(screen.getByTestId('query').textContent).not.toContain('enablement');
  expect(screen.getByTestId('query').textContent).not.toContain('alertStates');
});

it.each([
  { alertingRuleEnabled: true, enablement: 'Enabled' },
  { alertingRuleEnabled: undefined, enablement: 'Unknown' },
  { alertingRuleEnabled: null, enablement: 'Unknown' },
])('stacks alert counts below $enablement enablement', ({ alertingRuleEnabled, enablement }) => {
  const rule = fixtureRule('RepeatedRequestLatency');
  const pendingAlert = fixtureRule('ClusterNotUpgradeable').alerts[0];
  state.rules = [
    {
      ...rule,
      alertingRuleEnabled,
      alerts: [
        ...rule.alerts,
        {
          ...pendingAlert,
          labels: { ...pendingAlert.labels, alertname: rule.name },
        },
      ],
    },
  ];

  renderPage();

  const stateCell = within(tableRows()[0])
    .getAllByRole('cell')
    .find((cell) => cell.getAttribute('data-label') === 'State')!;
  expect(stateCell.textContent).toBe(` ${enablement} 3 Firing 1 Pending 3 Silenced`);
});

it.each([
  { ruleName: 'WorkloadAvailability', enablement: 'Enabled' },
  { ruleName: 'WorkloadMemoryHigh', enablement: 'Disabled' },
])('omits zero alert counts for $enablement rules', ({ ruleName, enablement }) => {
  state.rules = [fixtureRule(ruleName)];

  renderPage();

  expect(within(tableRows()[0]).getByText(enablement)).toBeDefined();
  expect(within(tableRows()[0]).queryByText(/Firing|Pending|Silenced/)).toBeNull();
});

it('shows enablement and only the silenced count for fully suppressed instances', () => {
  state.rules = [fixtureRule('ServiceUnavailable')];

  renderPage();

  expect(within(tableRows()[0]).getByText('Enabled')).toBeDefined();
  expect(within(tableRows()[0]).queryByText(/Firing|Pending/)).toBeNull();
  expect(within(tableRows()[0]).getByText('1 Silenced')).toBeDefined();
});

it('keeps rules and alert counts visible when silences could not be loaded', () => {
  state.silencesError = true;

  renderPage();

  expect(screen.getByText('Silences could not be loaded')).toBeDefined();
  expect(tableRows()).toHaveLength(20);

  const row = screen.getByText('AlertmanagerReceiversNotConfigured').closest('tr')!;
  expect(within(row).getByText('1 Silenced')).toBeDefined();
});

it('does not display rules with missing counts after an initial alerts request failure', () => {
  state.alertsError = true;

  renderPage();

  expect(screen.getByText('Alerts forbidden')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

it('keeps cached rules and counts visible when alerts could not be refreshed', () => {
  state.alertsError = true;
  state.hasCachedData = true;

  renderPage();

  expect(screen.getByText('Alerts could not be refreshed')).toBeDefined();
  expect(tableRows()).toHaveLength(20);
});

it('offers Enable for disabled rules and only logs the action', () => {
  const rule = fixtureRule('WorkloadMemoryHigh');
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  renderPage('?enablement=Disabled');
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${rule.name}` }));
  expect(screen.queryByRole('menuitem', { name: 'Disable' })).toBeNull();

  fireEvent.click(screen.getByRole('menuitem', { name: 'Enable' }));
  expect(debug).toHaveBeenCalledWith(`Alert rule enable: ${rule.name}, id: ${rule.id}`);
  expect(within(screen.getByText(rule.name).closest('tr')!).getByText('Disabled')).toBeDefined();

  debug.mockRestore();
});

it('does not assume enablement when the API omits it', () => {
  const rule = fixtureRule('WorkloadAvailability');
  delete rule.alertingRuleEnabled;
  state.rules = [rule];

  renderPage();

  expect(within(tableRows()[0]).getByText('Unknown')).toBeDefined();
});

it('displays the classification received from the Alerts API for a rule without overrides', () => {
  const rulesResponse = getMockRulesResponse();
  const alertsResponse = getMockAlertsResponse();
  const ruleName = 'AlertmanagerReceiversNotConfigured';
  const rule = rulesResponse.data.groups
    .flatMap((group) => group.rules)
    .find(({ name }) => name === ruleName)!;
  delete rule.labels.openshift_io_alert_rule_component;
  for (const alert of alertsResponse.data.alerts) {
    if (alert.labels.alertname === ruleName) {
      alert.alertComponent = 'monitoring';
      alert.alertLayer = 'namespace';
    }
  }
  state.rules = processAlertManagementData(rulesResponse, alertsResponse, {
    data: [],
    isLoading: false,
  })!.rules.filter(({ name }) => name === ruleName);

  renderPage();

  const cells = within(tableRows()[0]).getAllByRole('cell');
  expect(cells.find((cell) => cell.getAttribute('data-label') === 'Alert scope')?.textContent).toBe(
    'Namespace',
  );
  expect(
    cells.find((cell) => cell.getAttribute('data-label') === 'Affected component')?.textContent,
  ).toBe('monitoring');
});

it('filters by the varied rule components', () => {
  renderPage('?component=kube-apiserver');

  expect(tableRows()).toHaveLength(3);
  expect(screen.queryByText('ClusterNotUpgradeable')).toBeNull();
  expect(screen.getByText('WorkloadMemoryHigh')).toBeDefined();
  expect(screen.getByText('WorkloadQueueBacklog')).toBeDefined();
  expect(screen.getByText('WorkloadVolumeFull')).toBeDefined();
});

it('changes sort direction through the table header', () => {
  renderPage();
  fireEvent.click(
    within(screen.getByRole('columnheader', { name: 'Alert rule name' })).getByRole('button'),
  );
  expect(tableRows()[0].textContent).toContain('WorkloadVolumeFull');
  expect(screen.getByTestId('query').textContent).toContain('sortDirection=desc');
});

it('saves column visibility and keeps required columns', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Manage columns' }));
  const dialog = screen.getByRole('dialog');
  for (const name of ['Alert rule name', 'State', 'Severity']) {
    const checkbox = within(dialog).getByRole('checkbox', { name }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(true);
  }

  for (const name of ['Namespace', 'Managed by']) {
    const checkbox = within(dialog).getByRole('checkbox', { name }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
  }

  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Source' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(screen.queryByRole('columnheader', { name: 'Source' })).toBeNull();
  for (const name of ['Alert rule name', 'Severity', 'State', 'Namespace', 'Managed by']) {
    expect(screen.getByRole('columnheader', { name })).toBeDefined();
  }

  const cells = within(tableRows()[0]).getAllByRole('cell');
  expect(cells.find((cell) => cell.getAttribute('data-label') === 'Namespace')?.textContent).toBe(
    'openshift-monitoring',
  );
  expect(cells.find((cell) => cell.getAttribute('data-label') === 'Managed by')?.textContent).toBe(
    'Operator',
  );

  fireEvent.click(
    within(screen.getByRole('columnheader', { name: 'Namespace' })).getByRole('button'),
  );
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).get('sort')).toBe(
    'namespace',
  );
  expect(tableRows()[0].textContent).toContain('WorkloadJobFailures');

  fireEvent.click(
    within(screen.getByRole('columnheader', { name: 'Managed by' })).getByRole('button'),
  );
  expect(new URLSearchParams(screen.getByTestId('query').textContent!).get('sort')).toBe(
    'managedBy',
  );
});

it('handles no matches and API errors', () => {
  const view = renderPage('?name=missing');

  expect(screen.getByText('No alert rules found')).toBeDefined();

  view.unmount();
  state.error = true;

  renderPage();

  expect(screen.getByText('Forbidden')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

it.each(['loading', 'alertsLoading', 'silencesLoading'] as const)(
  'waits for all required data before rendering or clamping pagination (%s)',
  (loading) => {
    state[loading] = true;
    const router = renderPageWithHistory('?page=2');

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('No alert rules found')).toBeNull();
    expect(router.state.location.search).toBe('?page=2');
  },
);
