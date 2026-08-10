jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    isLoading: false,
    error: null,
    data: [],
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/mcp-overview/components/summary/SummaryCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/shared/hooks/usePerspective', () => ({
  usePerspective: jest.fn(() => ({ perspective: 'admin' })),
  getDashboardsListUrl: jest.fn(() => '/monitoring/v2/dashboards'),
}));

jest.mock('@/shared/utils/perses-client', () => ({
  fetchPersesDashboardsMetadata: jest.fn(),
}));

import { getDashboardsSummaryState } from '@/features/mcp-overview/components/summary/DashboardsSummaryCard';

describe('getDashboardsSummaryState', () => {
  it('should report loading from a mocked query result', () => {
    expect(
      getDashboardsSummaryState({
        isLoading: true,
        error: null,
        data: undefined,
      }),
    ).toEqual({
      loading: true,
      count: 0,
      error: undefined,
    });
  });

  it('should report error message and zero count from a mocked query result', () => {
    expect(
      getDashboardsSummaryState({
        isLoading: false,
        error: new Error('perses unavailable'),
        data: [{ metadata: { name: 'dash-1' } }],
      }),
    ).toEqual({
      loading: false,
      count: 0,
      error: 'perses unavailable',
    });
  });

  it('should stringify non-Error query errors', () => {
    expect(
      getDashboardsSummaryState({
        isLoading: false,
        error: 'network down',
        data: null,
      }),
    ).toEqual({
      loading: false,
      count: 0,
      error: 'network down',
    });
  });

  it('should report dashboard count from a mocked query result', () => {
    expect(
      getDashboardsSummaryState({
        isLoading: false,
        error: null,
        data: [{ metadata: { name: 'dash-1' } }, { metadata: { name: 'dash-2' } }],
      }),
    ).toEqual({
      loading: false,
      count: 2,
      error: undefined,
    });
  });
});
