import {
  fetchPersesProjects,
  fetchPersesDashboardsMetadata,
  fetchPersesDashboardsByProject,
} from '../perses-client';
import { useQuery } from '@tanstack/react-query';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../../query-params';
import { t } from 'i18next';

export const usePerses = (project?: string | number) => {
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);

  const {
    isLoading: persesProjectsLoading,
    error: persesProjectsError,
    data: persesProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchPersesProjects,
    enabled: true,
    refetchInterval: refreshInterval,
  });

  const {
    isLoading: persesDashboardsLoading,
    error: persesDashboardsError,
    data: persesDashboards,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: fetchPersesDashboardsMetadata,
    enabled: !project, // Only fetch all dashboards when no specific project is requested
    refetchInterval: refreshInterval,
  });

  const {
    isLoading: persesProjectDashboardsLoading,
    error: persesProjectDashboardsError,
    data: persesProjectDashboards,
  } = useQuery({
    queryKey: ['dashboards', 'project', project],
    queryFn: () => {
      if (project === undefined || project === null) {
        throw new Error(t('Project is required for fetching project dashboards'));
      }
      return fetchPersesDashboardsByProject(String(project));
    },
    enabled: !!project,
    refetchInterval: refreshInterval,
  });

  return {
    // All Dashboards - fallback to project dashboards when all dashboards query is disabled
    persesDashboards: (project ? persesProjectDashboards : persesDashboards) ?? [],
    persesDashboardsError: project ? persesProjectDashboardsError : persesDashboardsError,
    persesDashboardsLoading: project ? persesProjectDashboardsLoading : persesDashboardsLoading,
    // All Projects
    persesProjectsLoading,
    persesProjects: persesProjects ?? [],
    persesProjectsError,
    // Dashboards of a given project
    persesProjectDashboards: persesProjectDashboards ?? [],
    persesProjectDashboardsError,
    persesProjectDashboardsLoading,
  };
};
