/** @vitest-environment jsdom */

import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { legacy_createStore } from 'redux';

import { QueryBrowser } from '@/shared/components/query-browser/QueryBrowser';
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
});

it('keeps the request and graph fixed at the Unix epoch even when polling is enabled', async () => {
  vi.useFakeTimers();
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
            fixedEndTime={0}
            pollInterval={15000}
            hideControls
            disableZoom
          />
        </MemoryRouter>
      </Provider>,
    );
  });

  const params = new URL(fetchJSON.mock.calls[0][0], 'http://localhost').searchParams;
  expect(params.get('end')).toBe('0');
  expect(params.get('start')).toBe('-299.999');
  expect(screen.getByRole('status').textContent).toBe('-300000,0');
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(fetchJSON).toHaveBeenCalledTimes(1);
});
