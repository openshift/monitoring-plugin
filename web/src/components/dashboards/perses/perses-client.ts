import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { DashboardResource, ProjectResource } from '@perses-dev/core';
import { useQuery } from '@tanstack/react-query';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../query-params';

export const PERSES_PROXY_BASE_PATH = '/api/proxy/plugin/monitoring-console-plugin/perses';

export const fetchPersesDashboardsMetadata = (): Promise<DashboardResource[]> => {
  const listDashboardsMetadata = '/api/v1/dashboards';
  const persesURL = `${PERSES_PROXY_BASE_PATH}${listDashboardsMetadata}`;

  return consoleFetchJSON(persesURL);
};

export const fetchPersesProjects = (): Promise<ProjectResource[]> => {
  const listProjectURL = '/api/v1/projects';
  const persesURL = `${PERSES_PROXY_BASE_PATH}${listProjectURL}`;

  return consoleFetchJSON(persesURL);
};

export async function ocpPersesFetchJson<T>(url: string): Promise<T> {
  // Use perses fetch as base fetch call as it handles refresh tokens
  return consoleFetchJSON(url);
}

export const fetchPersesDashboard = async (
  project: string,
  dashboardName: string,
): Promise<DashboardResource> => {
  const getDashboardURL = `/api/v1/projects/${project}/dashboards/${dashboardName}`;
  const persesURL = `${PERSES_PROXY_BASE_PATH}${getDashboardURL}`;

  return await consoleFetchJSON(persesURL);
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
