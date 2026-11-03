/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router';

import { AlertGraph } from '@/shared/components/AlertGraph';
import type { Perspective } from '@/shared/constants/perspective';

const mocks = vi.hoisted(() => ({
  graph: vi.fn(),
  perspective: 'admin' as Perspective,
}));
vi.mock('@/shared/components/query-browser/QueryBrowser', () => ({ QueryBrowser: mocks.graph }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useMonitoringNamespace', () => ({
  useMonitoringNamespace: () => ({ namespace: 'workloads' }),
}));
vi.mock('@/shared/hooks/usePerspective', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/hooks/usePerspective')>()),
  usePerspective: () => ({ perspective: mocks.perspective }),
}));
vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  AlertStates: { Firing: 'firing', Pending: 'pending', Silenced: 'silenced' },
  AlertSeverity: { Critical: 'critical', Warning: 'warning', Info: 'info', None: 'none' },
}));

const query = 'sum(rate(cpu_usage_seconds_total[5m])) > 1';

beforeEach(() => {
  mocks.perspective = 'admin';
  mocks.graph.mockReset();
  mocks.graph.mockImplementation(({ GraphLink }: { GraphLink: ComponentType }) => <GraphLink />);
});

it('passes the query, labels, and series title formatter to the standard graph', () => {
  const labels = { namespace: 'workloads', alertname: 'HighCPU' };
  const formatSeriesTitle = () => 'CPU usage';
  render(
    <MemoryRouter>
      <AlertGraph
        query={query}
        ruleDuration={0}
        filterLabels={labels}
        formatSeriesTitle={formatSeriesTitle}
      />
    </MemoryRouter>,
  );

  const props = mocks.graph.mock.calls.at(-1)[0];
  expect(props.queries).toEqual([query]);
  expect(props.filterLabels).toBe(labels);
  expect(props.formatSeriesTitle).toBe(formatSeriesTitle);
  expect(props.hideControls).not.toBe(true);
});

it.each([
  { ruleDurationSeconds: 0, expectedTimespanMs: 30 * 60 * 1000 },
  { ruleDurationSeconds: 300, expectedTimespanMs: 30 * 60 * 1000 },
  { ruleDurationSeconds: 600, expectedTimespanMs: 30 * 60 * 1000 },
  { ruleDurationSeconds: 1200, expectedTimespanMs: 60 * 60 * 1000 },
])(
  'uses a rule-based range and polling interval for $ruleDurationSeconds seconds',
  ({ ruleDurationSeconds, expectedTimespanMs }) => {
    render(
      <MemoryRouter>
        <AlertGraph query={query} ruleDuration={ruleDurationSeconds} />
      </MemoryRouter>,
    );

    const props = mocks.graph.mock.calls.at(-1)[0];
    expect(props.defaultTimespan).toBe(expectedTimespanMs);
    expect(props.pollInterval).toBe(Math.round(expectedTimespanMs / 120));
  },
);

it.each([
  { perspective: 'admin', pathname: '/monitoring/query-browser' },
  { perspective: 'dev', pathname: '/dev-monitoring/ns/workloads/metrics' },
  { perspective: 'virtualization-perspective', pathname: '/virt-monitoring/query-browser' },
] as const)('links to Inspect in the $perspective perspective', ({ perspective, pathname }) => {
  mocks.perspective = perspective;
  render(
    <MemoryRouter>
      <AlertGraph query={query} ruleDuration={0} />
    </MemoryRouter>,
  );

  const href = screen.getByRole('link', { name: 'Inspect' }).getAttribute('href');
  const url = new URL(href, 'https://console.example.com');
  expect(url.pathname).toBe(pathname);
  expect(url.searchParams.get('query0')).toBe(query);
});

it('hides Inspect in the ACM perspective', () => {
  mocks.perspective = 'acm';
  render(
    <MemoryRouter>
      <AlertGraph query={query} ruleDuration={0} />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('link', { name: 'Inspect' })).toBeNull();
});
