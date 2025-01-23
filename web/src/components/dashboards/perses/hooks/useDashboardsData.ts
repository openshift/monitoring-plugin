import * as React from 'react';
import * as _ from 'lodash-es';

import { usePerses } from './usePerses';
import { MonitoringState } from '../../../../reducers/observe';
import { getDashboardsUrl, getObserveState, usePerspective } from '../../../hooks/usePerspective';
import { useSelector, useDispatch } from 'react-redux';
import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetName,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  queryBrowserDeleteAllQueries,
} from '../../../../actions/observe';
import {
  getAllQueryArguments,
  getQueryArgument,
  setQueryArgument,
} from '../../../console/utils/router';
import { MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../../shared/utils';
import { DashboardResource, VariableDefinition } from '@perses-dev/core';
import { useHistory } from 'react-router';
import { useActiveProject } from '../project/useActiveProject';
import { useBoolean } from '../../../hooks/useBoolean';
import { Map as ImmutableMap } from 'immutable';

// This hook syncs with mutliple external API's, redux, and URL state. Its a lot, but needs to all
// be in a single location
export const useDashboardsData = (urlBoard: string) => {
  const dispatch = useDispatch();
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

  // Retrieve selected dashboard name in store to sync with
  const dashboardName = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'name']),
  );

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

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  // Clear variables on unmount
  React.useEffect(
    () => () => dispatch(DashboardsClearVariables(perspective)),
    [perspective, dispatch],
  );

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
      const timeSpan = getQueryArgument('timeRange') ?? '';
      const endTime = getQueryArgument('endTime') ?? '';
      let url = getDashboardsUrl(perspective, newBoard);

      const refreshInterval = getQueryArgument('refreshInterval');
      const queryArguments = getAllQueryArguments();

      const params = new URLSearchParams(queryArguments);
      url = `${url}?${params.toString()}`;
      if (newBoard !== dashboardName) {
        if (getQueryArgument('dashboard') !== newBoard) {
          history.replace(url);
          setQueryArgument('project', activeProject);
        }

        const allVariables = getPersesVariables(persesDashboards, newBoard);
        dispatch(dashboardsPatchAllVariables(allVariables, perspective));

        // Set time range and poll interval options to their defaults or from the query params if
        // available
        if (refreshInterval) {
          dispatch(dashboardsSetPollInterval(_.toNumber(refreshInterval), perspective));
        }
        dispatch(dashboardsSetEndTime(_.toNumber(endTime) || null, perspective));
        dispatch(
          dashboardsSetTimespan(
            _.toNumber(timeSpan) || MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
            perspective,
          ),
        );

        dispatch(dashboardsSetName(newBoard, perspective));
      }
    },
    [perspective, dashboardName, dispatch, history, activeProject, persesDashboards],
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
  }, [dashboardName, changeBoard, urlBoard, activeProject, activeProjectDashboardsMetadata]);

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

const getPersesVariables = (boards: DashboardResource[], newDashboardName: string) => {
  const newDashboard = _.find(boards, { spec: { name: newDashboardName } });

  const allVariables = ImmutableMap<VariableDefinition>({});
  _.each(newDashboard?.spec?.variables, (variable) => {
    // if (variable.kind === 'ListVariable') {
    //   variable.spec.
    // }
    allVariables.set(variable.spec.name, variable);
  });

  return allVariables;
};

export type CombinedDashboardMetadata = {
  name: string;
  project?: string;
  tags: string[];
  title: string;
};
