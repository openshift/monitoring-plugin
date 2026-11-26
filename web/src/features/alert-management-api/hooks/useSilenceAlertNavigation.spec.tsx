/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useSilenceAlertNavigation } from '@/features/alert-management-api/hooks/useSilenceAlertNavigation';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), setNamespace: vi.fn(), namespace: 'team-a' }));
vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock('@/shared/hooks/useMonitoringNamespace', () => ({
  useMonitoringNamespace: () => ({ namespace: mocks.namespace, setNamespace: mocks.setNamespace }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.namespace = 'team-a';
});

it.each(['team-a', '#ALL_NS#'])(
  'switches from %s to the alert namespace before navigating',
  (namespace) => {
    mocks.namespace = namespace;
    const { result } = renderHook(useSilenceAlertNavigation);
    act(() => result.current.navigateToSilence({ alertname: 'Example', namespace: 'team-b' }));
    expect(mocks.setNamespace).toHaveBeenCalledExactlyOnceWith('team-b');
    expect(mocks.setNamespace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.navigate.mock.invocationCallOrder[0],
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/monitoring/v2/management/silences/~new?alertname=Example&namespace=team-b',
      { state: { silenceCanGoBack: true } },
    );
  },
);

it.each([{ namespace: 'team-a' }, {}])('does not change the selection for labels %j', (labels) => {
  const { result } = renderHook(useSilenceAlertNavigation);
  act(() => result.current.navigateToSilence(labels));
  expect(mocks.setNamespace).not.toHaveBeenCalled();
  expect(mocks.navigate).toHaveBeenCalledOnce();
});
