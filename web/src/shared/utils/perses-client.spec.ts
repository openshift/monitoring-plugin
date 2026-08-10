jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  consoleFetchJSON: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('use-query-params', () => ({
  NumberParam: {},
  useQueryParam: jest.fn(() => [undefined]),
}));

import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';

import {
  fetchPersesDashboard,
  fetchPersesDashboardsByProject,
  fetchPersesDashboardsMetadata,
  fetchPersesProjects,
  fetchPersesUserPermissions,
  PERSES_PROXY_BASE_PATH,
  useFetchPersesPermissions,
} from '@/shared/utils/perses-client';

const mockConsoleFetchJSON = consoleFetchJSON as jest.MockedFunction<typeof consoleFetchJSON>;
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

describe('perses-client URL construction', () => {
  beforeEach(() => {
    mockConsoleFetchJSON.mockReset();
    mockConsoleFetchJSON.mockResolvedValue([]);
  });

  it('fetchPersesDashboardsMetadata uses the dashboards metadata path', async () => {
    await fetchPersesDashboardsMetadata();

    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(
      `${PERSES_PROXY_BASE_PATH}/api/v1/dashboards`,
    );
  });

  it('fetchPersesDashboardsByProject encodes the project query param', async () => {
    await fetchPersesDashboardsByProject('my project/v1');

    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(
      `${PERSES_PROXY_BASE_PATH}/api/v1/dashboards?project=my%20project%2Fv1`,
    );
  });

  it('fetchPersesProjects uses the projects path', async () => {
    await fetchPersesProjects();

    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(`${PERSES_PROXY_BASE_PATH}/api/v1/projects`);
  });

  it('fetchPersesUserPermissions encodes the username path segment', async () => {
    await fetchPersesUserPermissions('user/name@example.com');

    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(
      `${PERSES_PROXY_BASE_PATH}/api/v1/users/user%2Fname%40example.com/permissions`,
    );
  });

  it('fetchPersesDashboard builds the project and dashboard path', async () => {
    await fetchPersesDashboard('observability', 'cluster-health');

    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(
      `${PERSES_PROXY_BASE_PATH}/api/v1/projects/observability/dashboards/cluster-health`,
    );
  });
});

describe('perses-client error propagation', () => {
  beforeEach(() => {
    mockConsoleFetchJSON.mockReset();
  });

  it.each([
    ['fetchPersesDashboardsMetadata', () => fetchPersesDashboardsMetadata()],
    ['fetchPersesDashboardsByProject', () => fetchPersesDashboardsByProject('project')],
    ['fetchPersesProjects', () => fetchPersesProjects()],
    ['fetchPersesUserPermissions', () => fetchPersesUserPermissions('user')],
    ['fetchPersesDashboard', () => fetchPersesDashboard('project', 'dashboard')],
  ])('%s propagates consoleFetchJSON errors unchanged', async (_name, invoke) => {
    const fetchError = new Error('perses unavailable');
    mockConsoleFetchJSON.mockRejectedValue(fetchError);

    await expect(invoke()).rejects.toBe(fetchError);
  });
});

describe('useFetchPersesPermissions', () => {
  beforeEach(() => {
    mockConsoleFetchJSON.mockReset();
    mockConsoleFetchJSON.mockResolvedValue({});
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((options: unknown) => {
      const queryOptions = options as {
        enabled?: boolean;
        queryFn?: () => unknown;
      };
      if (queryOptions.enabled) {
        void queryOptions.queryFn?.();
      }
      return {
        isLoading: false,
        error: null,
        data: undefined,
      } as ReturnType<typeof useQuery>;
    });
  });

  it('does not invoke consoleFetchJSON when username is empty', () => {
    useFetchPersesPermissions('');

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        queryKey: ['perses-user-permissions', ''],
      }),
    );
    expect(mockConsoleFetchJSON).not.toHaveBeenCalled();
  });

  it('invokes consoleFetchJSON when username is provided', () => {
    useFetchPersesPermissions('kubeadmin');

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: ['perses-user-permissions', 'kubeadmin'],
      }),
    );
    expect(mockConsoleFetchJSON).toHaveBeenCalledWith(
      `${PERSES_PROXY_BASE_PATH}/api/v1/users/kubeadmin/permissions`,
    );
  });
});
