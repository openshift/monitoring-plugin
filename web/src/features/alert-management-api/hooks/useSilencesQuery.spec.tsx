/** @vitest-environment jsdom */
import type { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useSilencesQuery } from '@/features/alert-management-api/hooks/useSilencesQuery';
import { makeSilence } from '@/features/alert-management-api/tests/utils/object-factories';
import { ProjectModel } from '@/shared/console/models';
import { getAlertmanagerSilencesUrl } from '@/shared/utils/utils';

const mocks = vi.hoisted(() => ({ consoleFetchJSON: vi.fn(), k8sListItems: vi.fn() }));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  ...mocks,
}));
vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({ prometheus: 'cmo' }),
}));

const globalUrl = getAlertmanagerSilencesUrl({ prometheus: 'cmo', useTenancyPath: false });
const tenancyUrl = (namespace: string) =>
  getAlertmanagerSilencesUrl({ prometheus: 'cmo', useTenancyPath: true, namespace });
const globalError = Object.assign(new Error('Global silences forbidden'), {
  response: { status: 403 },
});
const tenancyError = Object.assign(new Error('Namespace silences forbidden'), {
  response: { status: 403 },
});
const projects = ['first', 'second'].map((name) => ({ metadata: { name } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.k8sListItems.mockResolvedValue(projects);
  mocks.consoleFetchJSON.mockRejectedValue(globalError);
});
afterEach(() => {
  client.clear();
});

function mount(refreshIntervalMs: number | false = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSilencesQuery(refreshIntervalMs), { wrapper });
}

it.each([{ data: [] }, { data: [makeSilence()] }])(
  'returns a successful non-tenancy response without listing projects: $data',
  async ({ data }) => {
    mocks.consoleFetchJSON.mockResolvedValue(data);
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mocks.consoleFetchJSON).toHaveBeenCalledExactlyOnceWith(globalUrl, 'GET', {
      signal: expect.any(AbortSignal),
    });
    expect(mocks.k8sListItems).not.toHaveBeenCalled();
  },
);

it.each([404, 429, 500, 502, 503, 504, undefined])(
  'does not fall back to namespace requests for non-403/401 failures (status=%s)',
  async (status) => {
    const error = Object.assign(new Error('Silences request failed'), {
      response: status === undefined ? undefined : { status },
    });
    mocks.consoleFetchJSON.mockRejectedValue(error);

    const { result } = mount();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(mocks.consoleFetchJSON).toHaveBeenCalledExactlyOnceWith(globalUrl, 'GET', {
      signal: expect.any(AbortSignal),
    });
    expect(mocks.k8sListItems).not.toHaveBeenCalled();
  },
);

it('limits namespace concurrency to 25 and waits for later batches even if earlier batches fail', async () => {
  const namespaces = Array.from({ length: 53 }, (_, index) => `namespace-${index}`);
  const requests = namespaces.map(() => deferred<Silence[]>());
  mocks.k8sListItems.mockResolvedValue(namespaces.map((name) => ({ metadata: { name } })));
  mocks.consoleFetchJSON.mockImplementation((url: string) => {
    if (url === globalUrl) {
      return Promise.reject(globalError);
    }
    return requests[namespaces.findIndex((namespace) => tenancyUrl(namespace) === url)].promise;
  });

  const { result } = mount();
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(26));
  expect(result.current.isLoading).toBe(true);

  await act(async () => requests.slice(0, 24).forEach((request) => request.reject(tenancyError)));
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(26);

  await act(async () => requests[24].reject(tenancyError));
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(51));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isError).toBe(false);

  await act(async () => requests.slice(25, 50).forEach((request) => request.reject(tenancyError)));
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(54));
  expect(result.current.isLoading).toBe(true);

  const silences = [50, 51, 52].map((index) => makeSilence({ id: `silence-${index}` }));
  await act(async () => {
    // Resolve out of order; aggregation should still follow namespace order.
    requests[52].resolve([silences[2]]);
    requests[50].resolve([silences[0]]);
    requests[51].resolve([silences[1]]);
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(silences);
});

it('stays loading through the waterfall and all parallel requests, then aggregates partial success', async () => {
  const global = deferred<Silence[]>();
  const listing = deferred<typeof projects>();
  const first = deferred<Silence[]>();
  const second = deferred<Silence[]>();
  mocks.consoleFetchJSON.mockImplementation((url: string) => {
    if (url === globalUrl) {
      return global.promise;
    }
    return url === tenancyUrl('first') ? first.promise : second.promise;
  });
  mocks.k8sListItems.mockReturnValue(listing.promise);
  const { result } = mount();
  expect(result.current.isLoading).toBe(true);
  expect(mocks.k8sListItems).not.toHaveBeenCalled();

  await act(async () => global.reject(globalError));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isError).toBe(false);
  expect(mocks.k8sListItems).toHaveBeenCalledExactlyOnceWith({
    model: ProjectModel,
    queryParams: {},
    requestInit: { signal: expect.any(AbortSignal) },
  });
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(1);

  await act(async () => listing.resolve(projects));
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(3);
  for (const namespace of ['first', 'second']) {
    expect(mocks.consoleFetchJSON).toHaveBeenCalledWith(tenancyUrl(namespace), 'GET', {
      signal: expect.any(AbortSignal),
    });
  }
  const silence = makeSilence();
  await act(async () => first.resolve([silence]));
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isError).toBe(false);
  await act(async () => second.reject(tenancyError));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([silence]);
});

it('counts an empty namespace response as success even if other namespaces fail', async () => {
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === tenancyUrl('second') ? Promise.resolve([]) : Promise.reject(tenancyError),
  );
  const { result } = mount();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([]);
  expect(result.current.error).toBeNull();
});

it('waits for the final namespace before reporting that all silence requests failed', async () => {
  const second = deferred<Silence[]>();
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === tenancyUrl('second') ? second.promise : Promise.reject(globalError),
  );
  const { result } = mount();
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(3));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isError).toBe(false);
  await act(async () => second.reject(tenancyError));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBe(globalError);
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(3);
});

it('reports a project listing failure without making namespace requests', async () => {
  const error = new Error('Projects unavailable');
  mocks.k8sListItems.mockRejectedValue(error);
  const { result } = mount();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBe(error);
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(1);
});

it('preserves the original access error when no projects are accessible', async () => {
  mocks.k8sListItems.mockResolvedValue([]);
  const { result } = mount();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBe(globalError);
  expect(result.current.data).toBeUndefined();
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(1);
});

it('deduplicates namespaces and silence IDs and drops silences without an ID', async () => {
  mocks.k8sListItems.mockResolvedValue([...projects, projects[0], { metadata: {} }]);
  const shared = makeSilence({ id: 'shared' });
  const unique = makeSilence({ id: 'unique' });
  const noId = makeSilence({ id: undefined });
  mocks.consoleFetchJSON.mockImplementation((url: string) => {
    if (url === globalUrl) {
      return Promise.reject(globalError);
    }
    return Promise.resolve(url === tenancyUrl('first') ? [shared, noId] : [shared, unique]);
  });
  const { result } = mount();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([shared, unique]);
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(3);
});

it('shares one aggregate query across consumers and retains the polling interval', async () => {
  mocks.consoleFetchJSON.mockResolvedValue([]);
  const first = mount(30_000);
  const second = mount(30_000);
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(1);
  expect(client.getQueryCache().getAll()).toHaveLength(1);
  expect(client.getQueryCache().getAll()[0].options).toMatchObject({
    retry: false,
    refetchInterval: 30_000,
  });
});

it('keeps stale data during a refetch and only reports the final aggregate failure', async () => {
  const silence = makeSilence();
  mocks.consoleFetchJSON.mockResolvedValue([silence]);
  const { result } = mount();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.isFetching).toBe(false);
  expect(result.current.isError).toBe(false);
  const namespace = deferred<Silence[]>();
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === globalUrl ? Promise.reject(globalError) : namespace.promise,
  );
  let refetch: ReturnType<typeof result.current.refetch>;
  act(() => {
    refetch = result.current.refetch();
  });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(result.current.isError).toBe(false);
  expect(result.current.data).toEqual([silence]);
  await act(async () => {
    namespace.reject(tenancyError);
    await refetch;
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toEqual([silence]);
});

it('aborts an unused global request without starting project discovery', async () => {
  const pending = deferred<Silence[]>();
  mocks.consoleFetchJSON.mockReturnValue(pending.promise);
  const { unmount } = mount();
  const signal = mocks.consoleFetchJSON.mock.calls[0][2].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.reject(new DOMException('Aborted', 'AbortError')));
  expect(mocks.k8sListItems).not.toHaveBeenCalled();
});

it('does not start namespace requests when cancelled during project discovery', async () => {
  const listing = deferred<typeof projects>();
  mocks.k8sListItems.mockReturnValue(listing.promise);
  const { unmount } = mount();
  await waitFor(() => expect(mocks.k8sListItems).toHaveBeenCalledTimes(1));
  const signal = mocks.k8sListItems.mock.calls[0][0].requestInit.signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => listing.resolve(projects));
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(1);
});

it('does not start queued namespace batches after cancellation', async () => {
  const pending = deferred<Silence[]>();
  const namespaces = Array.from({ length: 26 }, (_, index) => `namespace-${index}`);
  mocks.k8sListItems.mockResolvedValue(namespaces.map((name) => ({ metadata: { name } })));
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === globalUrl ? Promise.reject(globalError) : pending.promise,
  );

  const { unmount } = mount();
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(26));
  const signal = mocks.consoleFetchJSON.mock.calls[0][2].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);

  await act(async () => pending.resolve([makeSilence()]));

  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(26);
  expect(mocks.consoleFetchJSON).not.toHaveBeenCalledWith(
    tenancyUrl(namespaces[25]),
    'GET',
    expect.anything(),
  );
  expect(client.getQueryData(['alert-management-api', 'cmo', 'silences'])).toBeUndefined();
});

it('restarts the sequence on refetch and uses global data if access is subsequently granted', async () => {
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === globalUrl ? Promise.reject(globalError) : Promise.resolve([]),
  );
  const { result } = mount();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([]);
  const silence = makeSilence();
  mocks.consoleFetchJSON.mockResolvedValue([silence]);
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toEqual([silence]));
  expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(4);
  expect(mocks.k8sListItems).toHaveBeenCalledTimes(1);
});

it('passes cancellation to every tenancy request without returning partial data', async () => {
  const pending = deferred<Silence[]>();
  mocks.consoleFetchJSON.mockImplementation((url: string) =>
    url === globalUrl ? Promise.reject(globalError) : pending.promise,
  );
  const { unmount } = mount();
  await waitFor(() => expect(mocks.consoleFetchJSON).toHaveBeenCalledTimes(3));
  const signal = mocks.consoleFetchJSON.mock.calls[0][2].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  expect(mocks.consoleFetchJSON.mock.calls.every((call) => call[2].signal === signal)).toBe(true);
  await act(async () => pending.resolve([makeSilence()]));
  expect(client.getQueryData(['alert-management-api', 'cmo', 'silences'])).toBeUndefined();
});
