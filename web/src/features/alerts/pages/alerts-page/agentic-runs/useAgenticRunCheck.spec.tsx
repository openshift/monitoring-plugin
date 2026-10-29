/** @vitest-environment jsdom */

import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

const mocks = vi.hoisted(() => ({
  k8sListItems: vi.fn(),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  k8sListItems: mocks.k8sListItems,
}));

vi.mock('@/shared/console/models', () => ({
  AgenticRunModel: { kind: 'AgenticRun' },
}));

import { getAlertFingerprintPrefix } from '@/features/alerts/pages/alerts-page/agentic-runs/alert-identifier';
import { AGENTIC_RUN_LABEL_FINGERPRINT } from '@/features/alerts/pages/alerts-page/agentic-runs/constants';
import { useAgenticRunCheck } from '@/features/alerts/pages/alerts-page/agentic-runs/useAgenticRunCheck';

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

// Alert without a `namespace` label so only the default-namespace query runs.
const alert = { labels: { alertname: 'Watchdog' } } as unknown as Alert;
const fingerprint = getAlertFingerprintPrefix(alert.labels);

const run = (
  name: string,
  creationTimestamp: string | undefined,
  fp: string = fingerprint,
): K8sResourceCommon => ({
  metadata: {
    name,
    creationTimestamp,
    labels: { [AGENTIC_RUN_LABEL_FINGERPRINT]: fp },
  },
});

describe('useAgenticRunCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns matching runs sorted most recent first, filtering out non-matches', async () => {
    mocks.k8sListItems.mockResolvedValue([
      run('old', '2024-01-01T00:00:00Z'),
      run('new', '2024-03-01T00:00:00Z'),
      run('mid', '2024-02-01T00:00:00Z'),
      run('other-alert', '2024-04-01T00:00:00Z', 'differentfp'),
    ]);

    const { result } = renderHook(() => useAgenticRunCheck(alert), { wrapper: createWrapper() });

    act(() => {
      result.current.prefetch();
    });

    await waitFor(() => expect(result.current.agenticRuns).toHaveLength(3));

    expect(result.current.agenticRuns.map((r) => r.metadata?.name)).toEqual(['new', 'mid', 'old']);
    expect(result.current.hasAgenticRun).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sorts runs without a creationTimestamp to the end', async () => {
    mocks.k8sListItems.mockResolvedValue([
      run('no-timestamp', undefined),
      run('newest', '2024-05-01T00:00:00Z'),
    ]);

    const { result } = renderHook(() => useAgenticRunCheck(alert), { wrapper: createWrapper() });

    act(() => {
      result.current.prefetch();
    });

    await waitFor(() => expect(result.current.agenticRuns).toHaveLength(2));

    expect(result.current.agenticRuns.map((r) => r.metadata?.name)).toEqual([
      'newest',
      'no-timestamp',
    ]);
  });

  it('reports no agentic run when nothing matches the fingerprint', async () => {
    mocks.k8sListItems.mockResolvedValue([
      run('other-alert', '2024-04-01T00:00:00Z', 'differentfp'),
    ]);

    const { result } = renderHook(() => useAgenticRunCheck(alert), { wrapper: createWrapper() });

    act(() => {
      result.current.prefetch();
    });

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.agenticRuns).toHaveLength(0);
    expect(result.current.hasAgenticRun).toBe(false);
  });
});
