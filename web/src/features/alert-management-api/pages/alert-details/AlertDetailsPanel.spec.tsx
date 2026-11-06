/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ComponentProps } from 'react';
import { MemoryRouter as BaseMemoryRouter, useLocation, useNavigate } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { AlertDetailsPanel } from '@/features/alert-management-api/pages/alert-details/AlertDetailsPanel';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

vi.mock('@/shared/hooks/agentic-runs/useAgenticRunCheck', () => ({
  useAgenticRunCheck: () => ({
    agenticRuns: [],
    hasAgenticRun: false,
    prefetch: vi.fn(),
    isFetching: false,
  }),
}));

const graph = vi.hoisted(() => vi.fn());
vi.mock('@/shared/components/AlertGraph', () => ({ AlertGraph: graph }));
beforeEach(() => {
  graph.mockReset();
  graph.mockReturnValue(<div>Rule expression graph</div>);
});
vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  AlertSeverity: { Critical: 'critical', Warning: 'warning', Info: 'info', None: 'none' },
  AlertStates: { Firing: 'firing', Pending: 'pending', Silenced: 'silenced' },
  ResourceLink: ({ kind, name }: { kind: string; name: string }) => (
    <span>
      {kind}: {name}
    </span>
  ),
  Timestamp: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const alert = testAlerts[0];

function MemoryRouter({ children, ...props }: ComponentProps<typeof BaseMemoryRouter>) {
  return (
    <BaseMemoryRouter {...props}>
      <QueryParamProvider adapter={ReactRouter7Adapter}>{children}</QueryParamProvider>
    </BaseMemoryRouter>
  );
}

function QueryControls() {
  const { search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="query">{search}</output>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
    </>
  );
}

it.each(['0', '1', 'invalid'])('resolves the tab from tab=%s', (tab) => {
  render(
    <MemoryRouter initialEntries={[`/?tab=${tab}`]}>
      <AlertDetailsPanel alert={alert} />
    </MemoryRouter>,
  );
  const name = tab === '1' ? 'Alert timeline' : 'Details';
  expect(
    screen.getByRole('tab', { name }).getAttribute('aria-selected'),
    'The URL should select the requested tab or default to Details',
  ).toBe('true');
});

it('preserves other parameters and supports browser history when changing tabs', () => {
  render(
    <MemoryRouter
      initialEntries={['/?alertID=abc&alertRuleID=rule&severity=critical&severity=warning']}
    >
      <AlertDetailsPanel alert={alert} />
      <QueryControls />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Alert timeline' }));
  const params = new URLSearchParams(screen.getByTestId('query').textContent);
  expect(params.get('tab'), 'Selecting the timeline should persist tab 1').toBe('1');
  expect(params.get('alertID'), 'Changing tabs should preserve the alert ID').toBe('abc');
  expect(params.get('alertRuleID'), 'Changing tabs should preserve the rule ID').toBe('rule');
  expect(params.getAll('severity'), 'Changing tabs should preserve repeated filters').toEqual([
    'critical',
    'warning',
  ]);
  fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
  expect(
    new URLSearchParams(screen.getByTestId('query').textContent).get('tab'),
    'Selecting Details should persist tab 0',
  ).toBe('0');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(
    screen.getByRole('tab', { name: 'Alert timeline' }).getAttribute('aria-selected'),
    'Back navigation should restore the timeline tab',
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
  expect(
    screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected'),
    'Forward navigation should restore the Details tab',
  ).toBe('true');
});

it('renders alert details and links', () => {
  render(
    <MemoryRouter>
      <AlertDetailsPanel alert={alert} />
    </MemoryRouter>,
  );
  expect(
    screen.getAllByText(alert.labels.resource),
    'The resource should appear in labels and the Resource field',
  ).toHaveLength(2);
  expect(
    screen.queryByText(`Pod: ${alert.labels.pod}`),
    'The resource should not be inferred from the pod label',
  ).toBeNull();
  expect(
    screen.getByText(`Namespace: ${alert.labels.namespace}`),
    'Details should include the namespace resource link',
  ).toBeDefined();
  expect(
    screen.getByRole('link', { name: alert.rule.name }),
    'Details should link to the alert rule',
  ).toBeDefined();
  expect(
    screen.getByRole('link', { name: alert.annotations.runbook_url }).getAttribute('href'),
    'The runbook link should use the runbook annotation',
  ).toBe(alert.annotations.runbook_url);
});

it('shows the namespace summary above the tabs and keeps it visible on the timeline', () => {
  render(
    <MemoryRouter>
      <AlertDetailsPanel alert={alert} />
    </MemoryRouter>,
  );
  const summary = screen.getByRole('region', { name: 'Namespace' });
  expect(
    within(summary).getByText(alert.labels.namespace),
    'The summary should show the alert namespace',
  ).toBeDefined();
  expect(
    summary.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING,
    'The namespace summary should precede the tabs',
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Alert timeline' }));
  expect(
    screen.getByRole('region', { name: 'Namespace' }),
    'The summary should remain mounted on the timeline tab',
  ).toBe(summary);
});

it('omits the namespace summary when the alert has no namespace', () => {
  const labels = { ...alert.labels };
  delete labels.namespace;
  render(
    <MemoryRouter>
      <AlertDetailsPanel alert={{ ...alert, labels }} />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole('region', { name: 'Namespace' }),
    'Alerts without a namespace should omit the summary',
  ).toBeNull();
});

it('mounts the rule expression graph only when opening the timeline', () => {
  render(
    <MemoryRouter>
      <AlertDetailsPanel alert={alert} />
    </MemoryRouter>,
  );
  expect(graph, 'The graph should not mount before opening the timeline').not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Alert timeline' }));
  expect(screen.getByRole('heading', { name: 'Alert timeline' })).toBeDefined();
  const props = graph.mock.calls.at(-1)[0];
  expect(props.ruleDuration, 'The timeline should use the selected alert rule duration').toBe(
    alert.rule.duration,
  );
  expect(props.query, 'The timeline should graph the selected alert rule query').toBe(
    alert.rule.query,
  );
  expect(
    props.filterLabels,
    'The timeline should filter series using the selected alert labels',
  ).toBe(alert.labels);
});

it('normalizes scheme-less runbook and dashboard URLs', () => {
  render(
    <MemoryRouter>
      <AlertDetailsPanel
        alert={{
          ...alert,
          annotations: {
            runbook_url: 'runbooks.example.com:8443/guide',
            dashboard_url: 'dashboards.example.com/overview',
          },
        }}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole('link', { name: 'runbooks.example.com:8443/guide' }).getAttribute('href'),
    'Scheme-less runbook URLs should be normalized to HTTPS',
  ).toBe('https://runbooks.example.com:8443/guide');
  expect(
    screen.getByRole('link', { name: 'dashboards.example.com/overview' }).getAttribute('href'),
    'Scheme-less dashboard URLs should be normalized to HTTPS',
  ).toBe('https://dashboards.example.com/overview');
});

it('does not link unsafe runbook URLs', () => {
  render(
    <MemoryRouter>
      <AlertDetailsPanel
        alert={{ ...alert, annotations: { runbook_url: 'javascript:alert(1)' } }}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByText('javascript:alert(1)'),
    'Unsafe URLs should remain visible as plain text',
  ).toBeDefined();
  expect(
    screen.queryByRole('link', { name: 'javascript:alert(1)' }),
    'Unsafe URLs should never become clickable links',
  ).toBeNull();
});
