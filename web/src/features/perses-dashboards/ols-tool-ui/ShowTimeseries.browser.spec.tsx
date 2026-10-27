import { vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { ShowTimeseries } from '@/features/perses-dashboards/ols-tool-ui/ShowTimeseries';

vi.mock(
  '@perses-dev/dashboards',
  () => import('@/features/perses-dashboards/ols-tool-ui/test-utils/MockPersesDashboards'),
);
vi.mock('@perses-dev/plugin-system', () => ({
  DataQueriesProvider: ({ children }) => children,
}));
vi.mock(
  '@/features/perses-dashboards/ols-tool-ui/helpers/OlsToolUIPersesWrapper',
  () => import('@/features/perses-dashboards/ols-tool-ui/test-utils/MockOlsToolUIPersesWrapper'),
);
vi.mock(
  '@/features/perses-dashboards/ols-tool-ui/helpers/AddToDashboardButton',
  () => import('@/features/perses-dashboards/ols-tool-ui/test-utils/MockAddToDashboardButton'),
);

const tool = {
  args: {
    title: 'CPU Usage',
    query: 'rate(process_cpu_seconds_total[5m])',
    description: 'CPU usage over time',
  },
};

const timeRange = () =>
  JSON.parse(page.getByTestId('perses-wrapper').element().getAttribute('data-time-range'));

describe('ShowTimeseries', () => {
  it('renders the panel with correct title and description', async () => {
    await render(<ShowTimeseries tool={tool} />);
    const definition = JSON.parse(
      page.getByTestId('panel-definition').element().getAttribute('data-definition'),
    );
    expect(definition.spec.display.name).toBe('CPU Usage');
    expect(definition.spec.display.description).toContain('CPU usage over time');
    expect(definition.spec.display.description).toContain('Query:');
  });

  it('renders the AddToDashboardButton with correct props', async () => {
    await render(<ShowTimeseries tool={tool} />);
    const button = page.getByTestId('add-to-dashboard');
    await expect.element(button).toHaveAttribute('data-name', tool.args.title);
    await expect.element(button).toHaveAttribute('data-query', tool.args.query);
    await expect.element(button).toHaveAttribute('data-description', tool.args.description);
  });

  it('wraps content in the Perses wrapper', async () => {
    await render(<ShowTimeseries tool={tool} />);
    await expect.element(page.getByTestId('perses-wrapper')).toBeInTheDocument();
    await expect.element(page.getByTestId('mock-panel')).toBeInTheDocument();
  });

  it.each([
    {
      name: 'defaults to 1h when no time args provided',
      timeArgs: {},
      expected: { pastDuration: '1h' },
    },
    {
      name: 'uses custom duration',
      timeArgs: { duration: '30m' },
      expected: { pastDuration: '30m' },
    },
    {
      name: 'treats end=NOW without start as relative',
      timeArgs: { end: 'NOW', duration: '2h' },
      expected: { pastDuration: '2h' },
    },
  ])('relative time range: $name', async ({ timeArgs, expected }) => {
    await render(<ShowTimeseries tool={{ args: { ...tool.args, ...timeArgs } }} />);
    expect(timeRange()).toEqual(expected);
  });

  it.each([
    {
      name: 'ISO start and end',
      timeArgs: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z', duration: '1h' },
      expected: { start: '2024-01-01T00:00:00.000Z', end: '2024-01-02T00:00:00.000Z' },
    },
    {
      name: 'ISO start with end=NOW',
      timeArgs: { start: '2024-01-01T00:00:00Z', end: 'NOW' },
      expected: { start: '2024-01-01T00:00:00.000Z', end: 0 },
    },
    {
      name: 'NOW-offset expressions (NOW-48h to NOW-24h)',
      timeArgs: { start: 'NOW-48h', end: 'NOW-24h' },
      expected: { start: 48 * 3600 * 1000, end: 24 * 3600 * 1000 },
    },
    {
      name: 'compound Prometheus-style duration (NOW-1d2h)',
      timeArgs: { start: 'NOW-1d2h', end: 'NOW' },
      expected: { start: (24 + 2) * 3600 * 1000, end: 0 },
    },
  ])('absolute time range: $name', async ({ timeArgs, expected }) => {
    const now = Date.now();
    await render(<ShowTimeseries tool={{ args: { ...tool.args, ...timeArgs } }} />);
    const range = timeRange();
    for (const key of ['start', 'end'] as const) {
      const value = expected[key];
      if (typeof value === 'string') {
        expect(range[key]).toBe(value);
      } else {
        expect(Math.abs(new Date(range[key]).getTime() - (now - value))).toBeLessThan(5000);
      }
    }
  });

  it('timezone support: defaults to UTC when not specified', async () => {
    await render(<ShowTimeseries tool={tool} />);
    await expect
      .element(page.getByTestId('perses-wrapper'))
      .toHaveAttribute('data-timezone', 'UTC');
  });
});
