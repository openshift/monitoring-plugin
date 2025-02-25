import { fetchPersesProjects, fetchPersesDashboardsMetadata } from '../perses-client';
import { useQuery } from '@tanstack/react-query';
import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../../query-params';

export const usePerses = () => {
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
    enabled: true,
    refetchInterval: refreshInterval,
  });

  return {
    persesDashboards: persesDashboards ?? [],
    persesDashboardsError,
    persesDashboardsLoading,
    persesProjectsLoading,
    persesProjects: persesProjects ?? [],
    persesProjectsError,
  };
};
