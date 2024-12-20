import { useBoolean } from '../../hooks/useBoolean';
import { fetchPersesProjects, fetchPersesDashboardsMetadata } from './perses-client';
import { useQuery } from '@tanstack/react-query';

export const usePerses = () => {
  // Start the queries off as disabled initially, then once triggered start polling
  const [dashboardsEnabled, , getDashboards] = useBoolean(false);

  const {
    isLoading: projectsLoading,
    error: projectsError,
    data: projects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchPersesProjects,
    enabled: true,
  });

  const {
    isLoading: dashboardsLoading,
    error: dashboardsError,
    data: dashboards,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: fetchPersesDashboardsMetadata,
    enabled: dashboardsEnabled,
  });

  return {
    dashboards,
    projectsLoading,
    dashboardsError,
    getDashboards,
    projects,
    dashboardsLoading,
    projectsError,
  };
};
