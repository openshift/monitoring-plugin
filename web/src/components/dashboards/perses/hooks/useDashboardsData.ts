import { useMemo, useCallback, useState } from 'react';

import { DashboardResource } from '@perses-dev/core';
import { useNavigate, useSearchParams } from 'react-router';
import { StringParam, useQueryParam } from 'use-query-params';
import { useBoolean } from '../../../hooks/useBoolean';
import { getDashboardUrl, usePerspective } from '../../../hooks/usePerspective';
import { QueryParams } from '../../../query-params';
import { useActiveProject } from '../project/useActiveProject';
import { usePerses } from './usePerses';
import { ALL_NAMESPACES_KEY } from '../../../utils';

// This hook syncs with mutliple external API's, redux, and URL state. Its a lot, but needs to all
// be in a single location
export const useDashboardsData = () => {
  const navigate = useNavigate();
  const { perspective } = usePerspective();
  const { activeProject, setActiveProject } = useActiveProject();
  const [queryParams] = useSearchParams();

  // track initial page load to prevent a full page loading state when swapping dashboards
  // or projects
  const [initialPageLoad, , , setInitialPageLoadFalse] = useBoolean(true);

  // Retrieve perses dashboard information
  const { persesProjects, persesProjectsLoading, persesDashboards, persesDashboardsLoading } =
    usePerses();
  const persesAvailable = !persesProjectsLoading && persesProjects;
  const [dashboardName] = useQueryParam(QueryParams.Dashboard, StringParam);

  // Determine when to stop having the full page loader be used
  const combinedInitialLoad = useMemo(() => {
    if (!initialPageLoad) {
      return false;
    }
    if (!(persesProjectsLoading || persesDashboardsLoading)) {
      setInitialPageLoadFalse();
      return false;
    }
    return true;
  }, [persesProjectsLoading, persesDashboardsLoading, initialPageLoad, setInitialPageLoadFalse]);

  const [prevDashboards, setPreviousDashboards] = useState<DashboardResource[]>([]);
  const [prevMetadata, setPreviousMetadata] = useState<CombinedDashboardMetadata[]>([]);

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const combinedDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (combinedInitialLoad) {
      return [];
    }

    // Check if dashboards data has actually changed to avoid recreation
    const dashboardsChanged =
      persesDashboards.length !== prevDashboards.length ||
      persesDashboards.some((dashboard, i) => {
        const prevDashboard = prevDashboards[i];
        return (
          dashboard?.metadata?.name !== prevDashboard?.metadata?.name ||
          dashboard?.spec?.display?.name !== prevDashboard?.spec?.display?.name ||
          dashboard?.metadata?.project !== prevDashboard?.metadata?.project
        );
      });

    if (!dashboardsChanged && prevMetadata.length > 0) {
      return prevMetadata;
    }

    const newMetadata = persesDashboards.map((persesDashboard) => {
      const name = persesDashboard?.metadata?.name;
      const displayName = persesDashboard?.spec?.display?.name || name;

      return {
        name,
        project: persesDashboard?.metadata?.project,
        tags: ['perses'],
        title: displayName,
        persesDashboard,
      };
    });

    setPreviousDashboards(persesDashboards);
    setPreviousMetadata(newMetadata);
    return newMetadata;
  }, [
    persesDashboards,
    combinedInitialLoad,
    prevDashboards,
    prevMetadata,
    setPreviousDashboards,
    setPreviousMetadata,
  ]);

  // Retrieve dashboard metadata for the currently selected project
  const activeProjectDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (activeProject === ALL_NAMESPACES_KEY) {
      return combinedDashboardsMetadata;
    }
    return combinedDashboardsMetadata.filter((combinedDashboardMetadata) => {
      return combinedDashboardMetadata.project === activeProject;
    });
  }, [combinedDashboardsMetadata, activeProject]);

  const changeBoard = useCallback(
    (newBoard: string) => {
      if (!newBoard) {
        // If the board is being cleared then don't do anything
        return;
      }

      const params = new URLSearchParams(queryParams);

      params.delete('edit');

      const dashboard = combinedDashboardsMetadata.find((item) => item.name === newBoard);

      const projectToUse =
        activeProject === ALL_NAMESPACES_KEY ? dashboard?.project : activeProject;

      if (projectToUse) {
        params.set(QueryParams.Project, projectToUse);
      }
      params.set(QueryParams.Dashboard, newBoard);
      if (dashboard?.persesDashboard?.spec?.duration) {
        params.set(QueryParams.Start, dashboard.persesDashboard.spec.duration);
      }
      if (dashboard?.persesDashboard?.spec?.refreshInterval) {
        params.set(QueryParams.Refresh, dashboard.persesDashboard.spec.refreshInterval);
      }

      let url = getDashboardUrl(perspective);
      url = `${url}?${params.toString()}`;

      if (newBoard !== dashboardName) {
        navigate(url, { replace: true });
      }
    },
    [perspective, dashboardName, navigate, activeProject, combinedDashboardsMetadata, queryParams],
  );

  return {
    persesAvailable,
    persesProjectsLoading,
    persesDashboards,
    dashboardName,
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedInitialLoad,
    setActiveProject,
    activeProject,
  };
};

export type CombinedDashboardMetadata = {
  name: string;
  project?: string;
  tags: string[];
  title: string;
  persesDashboard?: DashboardResource;
};
