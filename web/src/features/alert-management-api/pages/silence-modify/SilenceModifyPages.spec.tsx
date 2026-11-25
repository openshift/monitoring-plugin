/** @vitest-environment jsdom */
import type { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import type { MemoryRouterProps } from 'react-router';

import { useSilenceAlertNavigation } from '@/features/alert-management-api/hooks/useSilenceAlertNavigation';
import { AlertManagementRouter } from '@/features/alert-management-api/pages/AlertManagementRouter';
import { makeSilence } from '@/features/alert-management-api/tests/utils/object-factories';
import type { SilenceFormProps } from '@/shared/components/silences/SilenceForm';

const mocks = vi.hoisted(() => ({
  namespace: 'team-a',
  tenancy: true,
  accessLoading: false,
  setNamespace: vi.fn(),
  form: vi.fn(),
  query: {
    data: undefined as Silence[] | undefined,
    isLoading: false,
    error: null as Error | null,
  },
}));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  useActiveNamespace: () => {
    const [namespace, setNamespace] = useState(mocks.namespace);
    return [
      namespace,
      (value: string) => {
        mocks.setNamespace(value);
        mocks.namespace = value;
        setNamespace(value);
      },
    ];
  },
}));
vi.mock('@/features/alert-management-api/hooks/useSilencesQuery', () => ({
  useSilencesQuery: () => mocks.query,
}));
vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({
    prometheus: 'cmo',
    useAlertsTenancy: mocks.tenancy,
    accessCheckLoading: mocks.accessLoading,
  }),
}));
vi.mock('@/shared/hooks/useAlerts', () => ({
  useAlerts: () => {
    throw new Error('V2 must not load legacy alert data');
  },
}));
vi.mock('@/shared/components/silences/SilenceForm', () => ({
  SilenceFormContent: (props: SilenceFormProps) => {
    mocks.form({ ...props, namespaceAtMount: mocks.namespace });
    return (
      <div>
        <h1>{props.title}</h1>
        <pre data-testid="defaults">{JSON.stringify(props.defaults)}</pre>
        <button onClick={() => props.onSuccess('saved-id')}>Save</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    );
  },
}));
vi.mock('@/features/alert-management-api/components/layout/AlertManagementLayout', () => ({
  AlertManagementLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));
vi.mock('@/features/alert-management-api/pages/alerts-page/AlertsPage', () => ({
  AlertManagementAlertsPage: () => {
    const { navigateToSilence } = useSilenceAlertNavigation();
    return (
      <>
        <h1>Alerts list</h1>
        <button onClick={() => navigateToSilence({ alertname: 'Example' })}>Silence alert</button>
      </>
    );
  },
}));
vi.mock('@/features/incidents/pages/IncidentsPage', () => ({ McpCmoAlertingPage: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Location() {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  return (
    <output data-testid="location" data-navigation-type={navigationType}>
      {pathname}
      {search}
      {hash}
    </output>
  );
}

function mount(entry: string | NonNullable<MemoryRouterProps['initialEntries']>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={typeof entry === 'string' ? [entry] : entry}>
        <Location />
        <Routes>
          <Route path="/monitoring/v2/*" element={<AlertManagementRouter />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.namespace = 'team-a';
  mocks.tenancy = true;
  mocks.accessLoading = false;
  mocks.query = { data: undefined, isLoading: false, error: null };
});

it.each([
  'namespace=team-b&alertname=A%26B',
  'namespace=team-c&alertname=Old&namespace=team-b&alertname=A%26B',
])('prefills a direct create link using the last value for each label: %s', async (search) => {
  mount(`/monitoring/v2/management/silences/~new?${search}`);
  await screen.findByRole('heading', { name: 'Silence alert' });
  expect(mocks.setNamespace).toHaveBeenCalledExactlyOnceWith('team-b');
  expect(mocks.form.mock.calls.every(([props]) => props.namespaceAtMount === 'team-b')).toBe(true);
  expect(JSON.parse(screen.getByTestId('defaults').textContent!).matchers).toEqual([
    { name: 'namespace', value: 'team-b', isEqual: true, isRegex: false },
    { name: 'alertname', value: 'A&B', isEqual: true, isRegex: false },
  ]);
  expect(screen.queryByTestId('layout')).toBeNull();
});

it('does not change namespace for blank create and waits for access checks', () => {
  mocks.accessLoading = true;
  mount('/monitoring/v2/management/silences/~new');
  expect(mocks.form).not.toHaveBeenCalled();
  expect(mocks.setNamespace).not.toHaveBeenCalled();
});

it('creates without defaults and invalidates the shared query on success', async () => {
  const { invalidate } = mount('/monitoring/v2/management/silences/~new');
  expect(screen.getByRole('heading', { name: 'Create silence' })).toBeTruthy();
  expect(screen.getByTestId('defaults').textContent).toBe('{}');
  fireEvent.click(screen.getByText('Save'));
  expect(invalidate).toHaveBeenCalledWith(['alert-management-api', 'cmo', 'silences']);
  await screen.findByRole('heading', { name: 'Silences' });
  expect(screen.getByTestId('location').textContent).toBe(
    '/monitoring/v2/management/silences?silenceID=saved-id',
  );
});

it('goes back to the previous alerts entry when cancelling an in-app create', async () => {
  const source = '/monitoring/v2/alerts?severity=critical#alerts';
  mount(source);
  fireEvent.click(screen.getByRole('button', { name: 'Silence alert' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  await screen.findByRole('heading', { name: 'Alerts list' });
  const location = screen.getByTestId('location');
  expect(location.textContent).toBe(source);
  expect(location.dataset.navigationType).toBe('POP');
});

it.each([
  '/monitoring/v2/management/silences/~new',
  '/monitoring/v2/management/silences/silence-example/edit',
])('replaces the direct-entry form with the silences page on cancel: %s', async (path) => {
  mocks.tenancy = false;
  mocks.query.data = [makeSilence()];
  mount(path);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByRole('heading', { name: 'Silences' });
  const location = screen.getByTestId('location');
  expect(location.textContent).toBe('/monitoring/v2/management/silences');
  expect(location.dataset.navigationType).toBe('REPLACE');
});

it('resolves the matched edit ID across namespaces, outside the list layout', async () => {
  mocks.query.data = [
    makeSilence({ id: 'other' }),
    makeSilence({
      id: 'target',
      matchers: [{ name: 'namespace', value: 'team-b', isRegex: false, isEqual: true }],
    }),
  ];
  mount('/monitoring/v2/management/silences/target/edit');
  await screen.findByRole('heading', { name: /silence/ });
  expect(JSON.parse(screen.getByTestId('defaults').textContent!).id).toBe('target');
  expect(mocks.setNamespace).toHaveBeenCalledWith('team-b');
  expect(mocks.form.mock.calls.every(([props]) => props.namespaceAtMount === 'team-b')).toBe(true);
  expect(screen.queryByTestId('layout')).toBeNull();
});

it('uses the ID returned by the save when navigating from an edit', async () => {
  mocks.tenancy = false;
  mocks.query.data = [makeSilence()];
  mount('/monitoring/v2/management/silences/silence-example/edit');
  fireEvent.click(screen.getByText('Save'));
  await screen.findByRole('heading', { name: 'Silences' });
  expect(screen.getByTestId('location').textContent).toBe(
    '/monitoring/v2/management/silences?silenceID=saved-id',
  );
});

it.each(['active', 'pending', 'expired'])('retains %s edit/recreate behavior', (state) => {
  mocks.tenancy = false;
  mocks.query.data = [makeSilence({ status: { state: state as Silence['status']['state'] } })];
  mount('/monitoring/v2/management/silences/silence-example/edit');
  expect(
    screen.getByRole('heading', {
      name: state === 'expired' ? 'Recreate silence' : 'Edit silence',
    }),
  ).toBeTruthy();
  const defaults = JSON.parse(screen.getByTestId('defaults').textContent!);
  expect(!!defaults.endsAt).toBe(state !== 'expired');
  expect(!!mocks.form.mock.lastCall[0].Info).toBe(state !== 'expired');
  expect(mocks.setNamespace).not.toHaveBeenCalled();
});

it('does not render an editor until the silence query finishes', () => {
  mocks.query.isLoading = true;
  mount('/monitoring/v2/management/silences/target/edit');
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Silence not found' })).toBeNull();
  expect(mocks.form).not.toHaveBeenCalled();
});

it('waits for edit access before switching namespaces or mounting the form', () => {
  mocks.query.data = [
    makeSilence({
      matchers: [{ name: 'namespace', value: 'team-b', isRegex: false, isEqual: true }],
    }),
  ];
  mocks.accessLoading = true;
  mount('/monitoring/v2/management/silences/silence-example/edit');
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(mocks.setNamespace).not.toHaveBeenCalled();
  expect(mocks.form).not.toHaveBeenCalled();
});

it('shows query failures rather than mounting a missing editor', () => {
  mocks.query.error = new Error('Silences unavailable');
  mount('/monitoring/v2/management/silences/target/edit');
  expect(screen.getByText('Silences unavailable')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Silence not found' })).toBeNull();
  expect(mocks.form).not.toHaveBeenCalled();
});

it('shows a missing silence and goes to the silences page from a direct edit link', async () => {
  mocks.query.data = [];
  mount('/monitoring/v2/management/silences/unknown/edit');
  expect(screen.getByRole('heading', { name: 'Silence not found' })).toBeTruthy();
  expect(mocks.form).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('heading', { name: 'Silences' });
  expect(screen.getByTestId('location').dataset.navigationType).toBe('REPLACE');
});

it('goes back to the previous entry when an in-app edit cannot find the silence', async () => {
  mocks.query.data = [makeSilence()];
  const source = '/monitoring/v2/management/silences?state=active';
  mount([
    source,
    {
      pathname: '/monitoring/v2/management/silences/unknown/edit',
      state: { silenceCanGoBack: true },
    },
  ]);
  expect(screen.getByRole('heading', { name: 'Silence not found' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('heading', { name: 'Silences' });
  const location = screen.getByTestId('location');
  expect(location.textContent).toBe(source);
  expect(location.dataset.navigationType).toBe('POP');
});

it('retains cached edit data during a failed background refresh', () => {
  mocks.tenancy = false;
  mocks.query.data = [makeSilence()];
  mocks.query.error = new Error('Refresh failed');
  mount('/monitoring/v2/management/silences/silence-example/edit');
  expect(screen.getByRole('heading', { name: 'Edit silence' })).toBeTruthy();
});

it.each([
  { matchers: [] },
  { matchers: [{ name: 'namespace', value: 'team-.*', isRegex: true, isEqual: true }] },
  { matchers: [{ name: 'namespace', value: 'team-a', isRegex: false, isEqual: false }] },
])('does not overwrite ambiguous namespace matchers for restricted users: %j', ({ matchers }) => {
  mocks.query.data = [makeSilence({ matchers })];
  mount('/monitoring/v2/management/silences/silence-example/edit');
  expect(screen.getByText('Cannot edit silence in a single namespace')).toBeTruthy();
  expect(mocks.form).not.toHaveBeenCalled();
  expect(mocks.setNamespace).not.toHaveBeenCalled();
});

it('preserves unrestricted regex matchers without changing the selected namespace', () => {
  mocks.tenancy = false;
  const matchers = [{ name: 'namespace', value: 'team-.*', isRegex: true, isEqual: true }];
  mocks.query.data = [makeSilence({ matchers })];
  mount('/monitoring/v2/management/silences/silence-example/edit');
  expect(JSON.parse(screen.getByTestId('defaults').textContent!).matchers).toEqual(matchers);
  expect(mocks.setNamespace).not.toHaveBeenCalled();
});

it.each(['~new', 'silence-example/edit'])('contains render errors on the %s route', (route) => {
  const path = `/monitoring/v2/management/silences/${route}`;
  const error = new Error('Silence form failed to render');
  // React 18 also reports caught render errors as window events in development.
  const suppressExpectedError = (event: ErrorEvent) => {
    if (event.error === error) {
      event.preventDefault();
    }
  };

  window.addEventListener('error', suppressExpectedError);
  const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.tenancy = false;
  mocks.query.data = [makeSilence()];
  mocks.form.mockImplementation(() => {
    throw error;
  });

  try {
    mount(path);
    expect(screen.getByTestId('location').textContent).toBe(path);
    expect(screen.queryByTestId('defaults')).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      'Caught error in a child component:',
      error,
      expect.anything(),
    );
  } finally {
    window.removeEventListener('error', suppressExpectedError);
    logError.mockRestore();
    mocks.form.mockReset();
  }
});

it('still falls back for unknown v2 routes', async () => {
  mount('/monitoring/v2/unknown');
  await screen.findByRole('heading', { name: 'Alerts list' });
});
