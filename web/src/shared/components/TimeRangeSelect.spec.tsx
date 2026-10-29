/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { NumberParam, QueryParamProvider, useQueryParams } from 'use-query-params';

import { TimeRangeSelect } from '@/shared/components/TimeRangeSelect';
import { QueryParams } from '@/shared/constants/query-params';
import { TimeRangeParam } from '@/shared/constants/timespan';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

const QUERY_PARAMS_TEST_ID = 'time-range-query-params';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const text = key.replace(/\{\{count\}\}/g, String(values?.count ?? 'count'));
      return values?.count && values.count !== 1
        ? text
            .replace(/ minute$/, ' minutes')
            .replace(/ hour$/, ' hours')
            .replace(/ day$/, ' days')
            .replace(/ week$/, ' weeks')
        : text;
    },
  }),
}));

const QueryParamsComponent = () => {
  const [params] = useQueryParams({
    [QueryParams.TimeRange]: TimeRangeParam,
    [QueryParams.EndTime]: NumberParam,
  });
  return <output data-testid={QUERY_PARAMS_TEST_ID}>{JSON.stringify(params)}</output>;
};

const getQueryParams = () =>
  JSON.parse(screen.getByTestId(QUERY_PARAMS_TEST_ID).textContent || '{}') as Record<
    string,
    number | undefined
  >;

const dateInputs = () =>
  screen.getAllByRole('textbox', { name: 'Date picker' }) as HTMLInputElement[];

const renderWithQueryParams = (initialEntry: string, children: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryParamProvider adapter={ReactRouter7Adapter}>{children}</QueryParamProvider>
    </MemoryRouter>,
  );

describe('shared time-range selector', () => {
  it('updates the shared time-range query params for presets', async () => {
    renderWithQueryParams(
      '/dashboard?timeRange=1800000',
      <>
        <TimeRangeSelect />
        <QueryParamsComponent />
      </>,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 30 minutes' })));
    expect(screen.queryByRole('option', { name: 'Last 4 hours' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('option', { name: 'Last 1 hour' })));
    const params = getQueryParams();
    expect(params[QueryParams.TimeRange]).toBe(3600000);
    expect(params[QueryParams.EndTime]).toBeUndefined();
  });

  it('applies a custom range to the shared time-range query params', async () => {
    renderWithQueryParams(
      '/dashboard',
      <>
        <TimeRangeSelect />
        <QueryParamsComponent />
      </>,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Last 30 minutes' })));
    await act(async () =>
      fireEvent.click(screen.getByRole('option', { name: 'Custom time range' })),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    const [fromDate, toDate] = dateInputs();
    fireEvent.change(fromDate, {
      target: { value: '2026-09-29' },
    });
    fireEvent.change(toDate, {
      target: { value: '2026-09-30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    const params = getQueryParams();
    expect(params[QueryParams.TimeRange]).toBeGreaterThan(0);
    expect(params[QueryParams.EndTime]).toBeGreaterThan(0);
  });

  it('restores a custom range from the shared query params', async () => {
    const endTime = Date.parse('2026-09-30T12:00:00.000Z');
    renderWithQueryParams(`/dashboard?timeRange=3600000&endTime=${endTime}`, <TimeRangeSelect />);

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Custom time range' })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('option', { name: 'Custom time range' })),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    const [fromDate, toDate] = dateInputs();
    expect(fromDate.value).toBe('2026-09-30');
    expect(toDate.value).toBe('2026-09-30');
  });
});
