import { renderToStaticMarkup } from 'react-dom/server';

import { MpCmoAlertingPage } from './AlertingPage';

let mockOnNamespaceChange: (namespace: string) => void = () => {
  throw new Error('NamespaceBar not rendered');
};
let mockNamespace = 'namespace-a';
let mockUseAlertsTenancy = false;
const mockDispatch = jest.fn();
const mockSetNamespace = jest.fn();

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  HorizontalNav: () => null,
  ListPageHeader: () => null,
  NamespaceBar: ({ onNamespaceChange }: { onNamespaceChange: (namespace: string) => void }) => {
    mockOnNamespaceChange = onNamespaceChange;
    return null;
  },
  useActivePerspective: () => ['admin'],
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('react-router', () => ({ useLocation: () => ({ pathname: '/monitoring/alerts' }) }));
jest.mock('../../contexts/MonitoringContext', () => ({
  MonitoringProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../hooks/useMonitoring', () => ({
  useMonitoring: () => ({
    plugin: 'monitoring-plugin',
    prometheus: 'cmo',
    useAlertsTenancy: mockUseAlertsTenancy,
  }),
}));
jest.mock('../hooks/useMonitoringNamespace', () => ({
  useMonitoringNamespace: () => ({ namespace: mockNamespace, setNamespace: mockSetNamespace }),
}));

describe('AlertingPage namespace changes', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockSetNamespace.mockClear();
    mockNamespace = 'namespace-a';
    mockUseAlertsTenancy = false;
  });

  const selectAllProjects = () => {
    renderToStaticMarkup(<MpCmoAlertingPage />);
    mockOnNamespaceChange('#ALL_NS#');
  };

  it.each([false, true])('ignores the same namespace with tenancy %s', (useAlertsTenancy) => {
    mockNamespace = '#ALL_NS#';
    mockUseAlertsTenancy = useAlertsTenancy;
    selectAllProjects();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockSetNamespace).not.toHaveBeenCalled();
  });

  it('preserves shared alert data without tenancy', () => {
    selectAllProjects();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockSetNamespace).toHaveBeenCalledWith('#ALL_NS#');
  });

  it('clears namespace alert data with tenancy', () => {
    mockUseAlertsTenancy = true;
    selectAllProjects();
    expect(mockDispatch).toHaveBeenCalledWith({
      payload: { datasource: 'cmo', identifier: '#ALL_NS#' },
      type: 'v2/AlertingClearSelectorData',
    });
    expect(mockSetNamespace).toHaveBeenCalledWith('#ALL_NS#');
  });
});
