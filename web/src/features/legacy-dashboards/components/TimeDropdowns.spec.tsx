/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import {
  PollIntervalDropdown,
  TimespanDropdown,
} from '@/features/legacy-dashboards/components/TimeDropdowns';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const text = key.replace(/\{\{count\}\}/g, String(values?.count ?? 'count'));
      return values?.count && values.count !== 1
        ? text
            .replace(/ second$/, ' seconds')
            .replace(/ minute$/, ' minutes')
            .replace(/ hour$/, ' hours')
        : text;
    },
  }),
}));

const Query = () => {
  const { search } = useLocation();
  return <output data-testid="time-range-query-output">{search}</output>;
};
const queryParams = () =>
  new URLSearchParams(screen.getByTestId('time-range-query-output').textContent);

it('uses the shared timeRange and endTime query params', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring?timeRange=1800000']}>
      <QueryParamProvider adapter={ReactRouter7Adapter}>
        <TimespanDropdown />
        <Query />
      </QueryParamProvider>
    </MemoryRouter>,
  );

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 30 minutes' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Last 6 hours' })));
  expect(queryParams().get('timeRange')).toBe('21600000');

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 6 hours' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Custom time range' })));
  fireEvent.change(screen.getByLabelText(/^From\b/), {
    target: { value: '2026-09-29' },
  });
  fireEvent.change(screen.getByLabelText(/^To\b/), {
    target: { value: '2026-09-30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const params = queryParams();
  const from = new Date(2026, 8, 29, 0, 0).getTime();
  const to = new Date(2026, 8, 30, 23, 59).getTime();
  expect(Number(params.get('endTime'))).toBe(to);
  expect(Number(params.get('timeRange'))).toBe(to - from);
});

it('sets the refreshInterval query param when selecting 15 seconds', async () => {
  render(
    <MemoryRouter initialEntries={['/monitoring?refreshInterval=60000&timeRange=1800000']}>
      <QueryParamProvider adapter={ReactRouter7Adapter}>
        <PollIntervalDropdown />
        <Query />
      </QueryParamProvider>
    </MemoryRouter>,
  );

  await act(async () => fireEvent.click(screen.getByRole('button', { name: '1 minute' })));
  await act(async () => fireEvent.click(screen.getByRole('option', { name: '15 seconds' })));

  expect(queryParams().get('refreshInterval')).toBe('15000');
  expect(queryParams().get('timeRange')).toBe('1800000');
  expect(screen.getByRole('button', { name: '15 seconds' })).toBeDefined();
});
