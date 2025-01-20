import { fetchPersesProjects, fetchPersesDashboardsMetadata } from './perses-client';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getLegacyObserveState, usePerspective } from '../../hooks/usePerspective';
import { MonitoringState } from '../../../reducers/observe';

export const usePerses = () => {
  const { perspective } = usePerspective();
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'pollInterval']),
  );

  const {
    isLoading: persesProjectsLoading,
    error: persesProjectsError,
    data: persesProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchPersesProjects,
    enabled: true,
    refetchInterval: pollInterval,
  });

  const {
    isLoading: persesDashboardsLoading,
    error: persesDashboardsError,
    data: persesDashboards,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: fetchPersesDashboardsMetadata,
    enabled: true,
    refetchInterval: pollInterval,
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
