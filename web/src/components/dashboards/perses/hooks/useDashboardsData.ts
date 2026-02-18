import { useMemo, useCallback, useRef } from 'react';

import { DashboardResource } from '@perses-dev/core';
import { useHistory } from 'react-router-dom';
import { StringParam, useQueryParam } from 'use-query-params';
import { getAllQueryArguments } from '../../../console/utils/router';
import { useBoolean } from '../../../hooks/useBoolean';
import { getDashboardUrl, usePerspective } from '../../../hooks/usePerspective';
import { QueryParams } from '../../../query-params';
import { useActiveProject } from '../project/useActiveProject';
import { usePerses } from './usePerses';

// This hook syncs with mutliple external API's, redux, and URL state. Its a lot, but needs to all
// be in a single location
export const useDashboardsData = () => {
  const history = useHistory();
  const { perspective } = usePerspective();
  const { activeProject, setActiveProject } = useActiveProject();

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

  const prevDashboardsRef = useRef<DashboardResource[]>([]);
  const prevMetadataRef = useRef<CombinedDashboardMetadata[]>([]);

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const combinedDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (combinedInitialLoad) {
      return [];
    }

    // Check if dashboards data has actually changed to avoid recreation
    const dashboardsChanged =
      persesDashboards.length !== prevDashboardsRef.current.length ||
      persesDashboards.some((dashboard, i) => {
        const prevDashboard = prevDashboardsRef.current[i];
        return (
          dashboard?.metadata?.name !== prevDashboard?.metadata?.name ||
          dashboard?.spec?.display?.name !== prevDashboard?.spec?.display?.name ||
          dashboard?.metadata?.project !== prevDashboard?.metadata?.project
        );
      });

    if (!dashboardsChanged && prevMetadataRef.current.length > 0) {
      return prevMetadataRef.current;
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

    prevDashboardsRef.current = persesDashboards;
    prevMetadataRef.current = newMetadata;
    return newMetadata;
  }, [persesDashboards, combinedInitialLoad]);

  // Retrieve dashboard metadata for the currently selected project
  const activeProjectDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (!activeProject) {
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
      const queryArguments = getAllQueryArguments();

      delete queryArguments.edit;

      const params = new URLSearchParams(queryArguments);

      let projectToUse = activeProject;
      if (!activeProject) {
        const dashboardMetadata = combinedDashboardsMetadata.find((item) => item.name === newBoard);
        projectToUse = dashboardMetadata?.project;
      }

      if (projectToUse) {
        params.set(QueryParams.Project, projectToUse);
      }
      params.set(QueryParams.Dashboard, newBoard);

      let url = getDashboardUrl(perspective);
      url = `${url}?${params.toString()}`;

      if (newBoard !== dashboardName) {
        history.replace(url);
      }
    },
    [perspective, dashboardName, history, activeProject, combinedDashboardsMetadata],
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
