/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { legacy_createStore } from 'redux';
import { NumberParam } from 'use-query-params';

import { QueryBrowser } from '@/shared/components/query-browser/QueryBrowser';
import { queryBrowserSetTimespan } from '@/shared/store/actions';
import { defaultObserveState } from '@/shared/store/store';

const fetchJSON = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>());
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  useActiveNamespace: () => ['test'],
  consoleFetchJSON: fetchJSON,
}));
vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({
    plugin: 'monitoring-plugin',
    prometheus: 'cmo',
    accessCheckLoading: false,
  }),
}));
vi.mock('@patternfly/react-charts/victory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@patternfly/react-charts/victory')>()),
  Chart: ({ domain }: { domain: { x: number[] } }) => <output>{domain.x.join(',')}</output>,
}));

afterEach(() => {
  vi.useRealTimers();
  fetchJSON.mockReset();
});

it.each([
  { search: '?endTime=0', expectedEnd: 0, requestCount: 1 },
  { search: '?endTime=', expectedEnd: 1700000000000, requestCount: 2 },
  { search: '?endTime=abc', expectedEnd: 1700000000000, requestCount: 2 },
  { search: '?endTime=Infinity', expectedEnd: 1700000000000, requestCount: 2 },
])(
  'uses the expected range and polling for $search',
  async ({ search, expectedEnd, requestCount }) => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    const fixedEndTime = NumberParam.decode(new URLSearchParams(search).get('endTime'));
    fetchJSON.mockResolvedValue({
      data: { result: [{ metric: {}, values: [[0, '1']] }] },
    });
    const store = legacy_createStore(() => ({ plugins: { mp: defaultObserveState } }));

    await act(async () => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <QueryBrowser
              queries={['vector(1)']}
              timespan={300000}
              fixedEndTime={fixedEndTime}
              pollInterval={15000}
              hideControls
              disableZoom
            />
          </MemoryRouter>
        </Provider>,
      );
    });

    const params = new URL(fetchJSON.mock.calls[0][0], 'http://localhost').searchParams;
    const expectedStart = expectedEnd - 300000;
    expect(params.get('end')).toBe(String(expectedEnd / 1000));
    expect(params.get('start')).toBe(String((expectedStart + 1) / 1000));
    expect(screen.getByRole('status').textContent).toBe(`${expectedStart},${expectedEnd}`);
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(fetchJSON).toHaveBeenCalledTimes(requestCount);
  },
);

it.each([
  { caller: 'without a callback', notifyParent: false },
  { caller: 'with a callback', notifyParent: true },
])(
  'preserves a fixed graph after reselecting the same duration $caller',
  async ({ notifyParent }) => {
    vi.useFakeTimers();
    const span = 300000;
    fetchJSON.mockResolvedValue({
      data: { result: [{ metric: {}, values: [[0, '1']] }] },
    });
    const store = legacy_createStore(() => ({ plugins: { mp: defaultObserveState } }));
    const dispatch = vi.spyOn(store, 'dispatch');
    const onSpanChange = notifyParent ? vi.fn() : undefined;

    await act(async () => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <QueryBrowser
              queries={['vector(1)']}
              timespan={span}
              fixedEndTime={0}
              onSpanChange={onSpanChange}
              disableZoom
            />
          </MemoryRouter>
        </Provider>,
      );
    });

    expect(screen.getByRole('status').textContent).toBe('-300000,0');
    fireEvent.click(screen.getByRole('button', { name: 'graph timespan' }));
    fireEvent.click(screen.getByText('5m'));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(screen.getByRole('status').textContent).toBe('-300000,0');
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    if (onSpanChange) {
      expect(onSpanChange).toHaveBeenCalledWith(span);
      expect(dispatch).toHaveBeenCalledWith(queryBrowserSetTimespan(span));
    }
  },
);
