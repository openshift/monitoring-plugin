import { fetchPersesProjects, fetchPersesDashboardsMetadata } from './perses-client';
import { useQuery } from '@tanstack/react-query';

export const usePerses = () => {
  const {
    isLoading: persesProjectsLoading,
    error: persesProjectsError,
    data: persesProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchPersesProjects,
    enabled: true,
  });

  const {
    isLoading: persesDashboardsLoading,
    error: persesDashboardsError,
    data: persesDashboards,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: fetchPersesDashboardsMetadata,
    enabled: true,
  });

  return {
    persesDashboards,
    persesDashboardsError,
    persesDashboardsLoading,
    persesProjectsLoading,
    persesProjects,
    persesProjectsError,
  };
};
