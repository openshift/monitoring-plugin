import { useQuery } from '@tanstack/react-query';
import { DashboardResource, ProjectResource, fetchJson } from '@perses-dev/core';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../query-params';
import { getCSRFToken } from '@openshift-console/dynamic-plugin-sdk/lib/utils/fetch/console-fetch-utils';

export const PERSES_PROXY_BASE_PATH = '/api/proxy/plugin/monitoring-console-plugin/perses';

export const fetchPersesDashboardsMetadata = (): Promise<DashboardResource[]> => {
  const listDashboardsMetadata = '/api/v1/dashboards';
  const persesURL = `${PERSES_PROXY_BASE_PATH}${listDashboardsMetadata}`;

  return ocpPersesFetchJson<DashboardResource[]>(persesURL);
};

export const fetchPersesDashboardsByProject = (project: string): Promise<DashboardResource[]> => {
  const dashboardsEndpoint = `${PERSES_PROXY_BASE_PATH}/api/v1/dashboards`;
  const persesURL = `${dashboardsEndpoint}?project=${encodeURIComponent(project)}`;

  return ocpPersesFetchJson<DashboardResource[]>(persesURL);
};

export const fetchPersesProjects = (): Promise<ProjectResource[]> => {
  const listProjectURL = '/api/v1/projects';
  const persesURL = `${PERSES_PROXY_BASE_PATH}${listProjectURL}`;

  return ocpPersesFetchJson<ProjectResource[]>(persesURL);
};

export interface PersesPermission {
  scopes: string;
  actions: string[];
}

export type PersesUserPermissions = {
  [projectName: string]: PersesPermission[];
};

export const fetchPersesUserPermissions = (username: string): Promise<PersesUserPermissions> => {
  const userPermissionsURL = `/api/v1/users/${encodeURIComponent(username)}/permissions`;
  const persesURL = `${PERSES_PROXY_BASE_PATH}${userPermissionsURL}`;

  return ocpPersesFetchJson<PersesUserPermissions>(persesURL);
};

export async function ocpPersesFetchJson<T>(url: string): Promise<T> {
  // Use perses fetch as base fetch call as it handles refresh tokens
  return fetchJson(url, {
    headers: {
      'X-CSRFToken': getCSRFToken(),
    },
  });
}

export const fetchPersesDashboard = async (
  project: string,
  dashboardName: string,
): Promise<DashboardResource> => {
  const getDashboardURL = `/api/v1/projects/${project}/dashboards/${dashboardName}`;
  const persesURL = `${PERSES_PROXY_BASE_PATH}${getDashboardURL}`;

  return await ocpPersesFetchJson<DashboardResource>(persesURL);
};

export const useFetchPersesDashboard = (project: string, dashboardName: string) => {
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);

  const {
    isLoading: persesDashboardLoading,
    error: persesDashboardError,
    data: persesDashboard,
  } = useQuery({
    queryKey: ['dashboards', project, dashboardName],
    queryFn: () => fetchPersesDashboard(project, dashboardName),
    enabled: true,
    refetchInterval: refreshInterval,
  });

  return {
    persesDashboard,
    persesDashboardError,
    persesDashboardLoading,
  };
};

export const useFetchPersesPermissions = (username: string) => {
  const {
    isLoading: persesPermissionsLoading,
    error: persesPermissionsError,
    data: persesUserPermissions,
  } = useQuery({
    queryKey: ['perses-user-permissions', username],
    queryFn: () => fetchPersesUserPermissions(username),
    enabled: !!username,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch Perses user permissions:', error);
    },
  });

  return {
    persesUserPermissions,
    persesPermissionsError,
    persesPermissionsLoading,
  };
};
