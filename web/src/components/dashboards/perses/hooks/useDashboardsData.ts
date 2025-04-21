import * as React from 'react';

import { usePerses } from './usePerses';
import { getDashboardsUrl, usePerspective } from '../../../hooks/usePerspective';
import { getAllQueryArguments } from '../../../console/utils/router';
import { useActiveProject } from '../project/useActiveProject';
import { useBoolean } from '../../../hooks/useBoolean';
import { QueryParams } from '../../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { useNavigate } from 'react-router-dom-v5-compat';

// This hook syncs with mutliple external API's, redux, and URL state. Its a lot, but needs to all
// be in a single location
export const useDashboardsData = () => {
  const navigate = useNavigate();
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
  const combinedIntialLoad = React.useMemo(() => {
    if (!initialPageLoad) {
      return false;
    }
    if (!(persesProjectsLoading || persesDashboardsLoading)) {
      setInitialPageLoadFalse();
      return false;
    }
    return true;
  }, [persesProjectsLoading, persesDashboardsLoading, initialPageLoad, setInitialPageLoadFalse]);

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const combinedDashboardsMetadata = React.useMemo<CombinedDashboardMetadata[]>(() => {
    if (combinedIntialLoad) {
      return [];
    }
    return persesDashboards.map((persesDashboard) => {
      // Locate display name of project
      const matchingProject = persesProjects.find(
        (persesProject) => persesProject?.metadata?.name === persesDashboard?.metadata?.project,
      );
      return {
        name: persesDashboard?.metadata?.name,
        project: persesDashboard?.metadata?.project,
        tags: ['perses'],
        title: `${matchingProject.spec?.display?.name} / ${persesDashboard?.spec?.display?.name}`,
      };
    });
  }, [persesDashboards, persesProjects, combinedIntialLoad]);

  // Retrieve dashboard metadata for the currently selected project
  const activeProjectDashboardsMetadata = React.useMemo<CombinedDashboardMetadata[]>(() => {
    return combinedDashboardsMetadata.filter((combinedDashboardMetadata) => {
      return combinedDashboardMetadata.project === activeProject;
    });
  }, [combinedDashboardsMetadata, activeProject]);

  const changeBoard = React.useCallback(
    (newBoard: string) => {
      if (!newBoard) {
        // If the board is being cleared then don't do anything
        return;
      }
      const queryArguments = getAllQueryArguments();

      const params = new URLSearchParams(queryArguments);
      params.set(QueryParams.Project, activeProject);
      params.set(QueryParams.Dashboard, newBoard);

      let url = getDashboardsUrl(perspective);
      url = `${url}?${params.toString()}`;

      if (newBoard !== dashboardName) {
        navigate(url, { replace: true });
      }
    },
    [activeProject, perspective, dashboardName, navigate],
  );

  // If a dashboard hasn't been selected yet, or if the current project doesn't have a
  // matching board name then display the board present in the URL parameters or the first
  // board in the dropdown list
  React.useEffect(() => {
    const metadataMatch = activeProjectDashboardsMetadata.find((activeProjectDashboardMetadata) => {
      return (
        activeProjectDashboardMetadata.project === activeProject &&
        activeProjectDashboardMetadata.name === dashboardName
      );
    });
    if (!dashboardName || !metadataMatch) {
      changeBoard(activeProjectDashboardsMetadata?.[0]?.name);
    }
  }, [dashboardName, changeBoard, activeProject, activeProjectDashboardsMetadata]);

  return {
    persesAvailable,
    persesProjectsLoading,
    persesDashboards,
    dashboardName,
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedIntialLoad,
    setActiveProject,
    activeProject,
  };
};

export type CombinedDashboardMetadata = {
  name: string;
  project?: string;
  tags: string[];
  title: string;
};
