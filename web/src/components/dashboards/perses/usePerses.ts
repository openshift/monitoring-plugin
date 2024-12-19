import { useBoolean } from 'src/components/hooks/useBoolean';
import { fetchPersesProjects, fetchPersesDashboardsMetadata } from './perses-client';
import { useQuery } from '@tanstack/react-query';

// const isAbortError = (error: unknown): boolean =>
//   error instanceof Error && error.name === 'AbortError';

// type State = {
//   dashboards: PersesDashboardMetadata[];
//   isLoadingDashboards: boolean;
//   dashboardsError: unknown;
//   projects: PersesProject[];
//   isLoadingProjects: boolean;
//   projectsError: unknown;
// };

export const usePerses = () => {
  // Start the queries off as disabled initially, then once triggered start polling
  const [projectsEnabled, , getProjects] = useBoolean(false);
  const [dashboardsEnabled, , getDashboards] = useBoolean(false);

  const {
    isLoading: projectsLoading,
    error: projectsError,
    data: projects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchPersesProjects,
    enabled: projectsEnabled,
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
    getProjects,
  };
};
