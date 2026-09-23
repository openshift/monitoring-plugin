/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { MpCmoAlertingPage } from '@/features/alerts/pages/AlertingPage';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setNamespace: vi.fn(),
  useAlertsTenancy: false,
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  HorizontalNav: () => null,
  ListPageHeader: () => null,
  NamespaceBar: ({ onNamespaceChange }: { onNamespaceChange: (namespace: string) => void }) => (
    <button onClick={() => onNamespaceChange('#ALL_NS#')}>Select All Projects</button>
  ),
  useActivePerspective: () => ['admin'],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-redux', () => ({
  useDispatch: () => mocks.dispatch,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: '/monitoring/alerts' }),
}));

vi.mock('@/shared/contexts/MonitoringContext', () => ({
  MonitoringProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({
    plugin: 'monitoring-plugin',
    prometheus: 'cmo',
    useAlertsTenancy: mocks.useAlertsTenancy,
  }),
}));

vi.mock('@/shared/hooks/useMonitoringNamespace', () => ({
  useMonitoringNamespace: () => ({ setNamespace: mocks.setNamespace }),
}));

describe('AlertingPage namespace changes', () => {
  beforeEach(() => {
    mocks.dispatch.mockClear();
    mocks.setNamespace.mockClear();
    mocks.useAlertsTenancy = false;
  });

  it('preserves shared alert data when tenancy is disabled', () => {
    render(<MpCmoAlertingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All Projects' }));

    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.setNamespace).toHaveBeenCalledWith('#ALL_NS#');
  });

  it('clears namespace alert data when tenancy is enabled', () => {
    mocks.useAlertsTenancy = true;
    render(<MpCmoAlertingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select All Projects' }));

    expect(mocks.dispatch).toHaveBeenCalledWith({
      payload: { datasource: 'cmo', identifier: '#ALL_NS#' },
      type: 'v2/AlertingClearSelectorData',
    });
    expect(mocks.setNamespace).toHaveBeenCalledWith('#ALL_NS#');
  });
});
