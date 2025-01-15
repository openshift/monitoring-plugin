import * as React from 'react';
import * as _ from 'lodash-es';

import { usePerses } from '../perses/usePerses';
import { useLegacyDashboards } from '../legacy/useLegacyDashboards';
import { MonitoringState } from '../../../reducers/observe';
import {
  getDashboardsUrl,
  getObserveState,
  usePerspective,
} from '../../../components/hooks/usePerspective';
import { useSelector, useDispatch } from 'react-redux';
import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetName,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  queryBrowserDeleteAllQueries,
} from '../../../actions/observe';
import { getQueryArgument, setQueryArgument } from '../../console/utils/router';
import { getAllVariables, MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from './utils';
import { useHistory } from 'react-router';
import { LEGACY_DASHBOARDS_KEY } from '../perses/project/utils';
import { useActiveProject } from '../perses/project/useActiveProject';
import { useBoolean } from '../../hooks/useBoolean';

// This hook syncs with mutliple external API's, redux, and URL state. Its a lot, but needs to all
// be in a single location
export const useDashboardsData = (namespace: string, urlBoard: string) => {
  const dispatch = useDispatch();
  const history = useHistory();
  const { perspective } = usePerspective();
  const { activeProject, setActiveProject } = useActiveProject();

  // track initial page load to prevent a full page loading state when swapping dashboards
  // or projects
  const [initialPageLoad, , , setInitialPageLoadFalse] = useBoolean(true);

  // Retrieve legacy dashboard information
  const [legacyDashboards, legacyDashboardsLoading, legacyDashboardsError] =
    useLegacyDashboards(namespace);

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
    if (!(legacyDashboardsLoading || persesProjectsLoading || persesDashboardsLoading)) {
      setInitialPageLoadFalse();
      return false;
    }
    return true;
  }, [
    legacyDashboardsLoading,
    persesProjectsLoading,
    persesDashboardsLoading,
    initialPageLoad,
    setInitialPageLoadFalse,
  ]);

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  // Clear variables on unmount for dev perspective
  React.useEffect(
    () => () => {
      if (perspective === 'dev') {
        dispatch(DashboardsClearVariables(perspective));
      }
    },
    [perspective, dispatch],
  );

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const combinedDashboardsMetadata = React.useMemo<CombinedDashboardMetadata[]>(() => {
    if (combinedIntialLoad) {
      return [];
    }
    if (activeProject === LEGACY_DASHBOARDS_KEY) {
      return legacyDashboards.map((legacyDashboard) => {
        return {
          name: legacyDashboard.name,
          project: LEGACY_DASHBOARDS_KEY,
          tags: legacyDashboard.data?.tags,
          title: legacyDashboard.data?.title ?? legacyDashboard.name,
        };
      });
    } else {
      return persesDashboards.map((persesDashboard) => {
        // Locate display name of project
        const matchingProject = persesProjects.find(
          (persesProject) => persesProject.metadata?.name === persesDashboard.metadata?.project,
        );
        return {
          name: persesDashboard.metadata?.name,
          project: persesDashboard.metadata?.project,
          tags: ['perses'],
          title: `${matchingProject.spec?.display?.name} / ${persesDashboard.spec.display.name}`,
        };
      });
    }
  }, [legacyDashboards, persesDashboards, persesProjects, activeProject, combinedIntialLoad]);

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
      let timeSpan: string;
      let endTime: string;
      let url = getDashboardsUrl(perspective, newBoard, namespace);

      const refreshInterval = getQueryArgument('refreshInterval');

      if (dashboardName) {
        timeSpan = null;
        endTime = null;
        // persist only the refresh Interval when dashboard is changed
        if (refreshInterval) {
          const params = new URLSearchParams({ refreshInterval });
          url = `${url}?${params.toString()}`;
        }
      } else {
        timeSpan = getQueryArgument('timeRange');
        endTime = getQueryArgument('endTime');
      }
      if (newBoard !== dashboardName) {
        if (getQueryArgument('dashboard') !== newBoard) {
          history.replace(url);
          if (perspective !== 'dev') {
            // Don't set project in dev perspective since perses dashboards
            // aren't supported there yet
            setQueryArgument('project', activeProject);
          }
        }

        // TODO: Determine how perses dashboards store variables and determine if they
        // need to be stored in the redux store. If now, change to "legacy variables"
        // or something similar
        const allVariables = getAllVariables(legacyDashboards, newBoard, namespace);
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
    [perspective, dashboardName, legacyDashboards, dispatch, history, namespace, activeProject],
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
    if (!dashboardName) {
      const boardName = namespace ? getQueryArgument('dashboard') : urlBoard;
      if (
        boardName &&
        !_.isEmpty(legacyDashboards) &&
        legacyDashboards.find((tempBoard) => tempBoard.name === boardName)
      ) {
        changeBoard(boardName);
      } else {
        changeBoard(activeProjectDashboardsMetadata?.[0]?.name);
      }
    } else if (!metadataMatch) {
      changeBoard(activeProjectDashboardsMetadata?.[0]?.name);
    }
  }, [
    dashboardName,
    legacyDashboards,
    changeBoard,
    urlBoard,
    namespace,
    activeProject,
    activeProjectDashboardsMetadata,
  ]);

  React.useEffect(() => {
    // Dashboard query argument is only set in dev perspective, so skip for admin
    if (perspective !== 'dev') {
      return;
    }
    const newBoard = getQueryArgument('dashboard');
    const allVariables = getAllVariables(legacyDashboards, newBoard, namespace);
    dispatch(dashboardsPatchAllVariables(allVariables, perspective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  // If we don't find any rows, build the legacy dashboard
  // rows array based on what we have in `data.panels`
  const legacyRows = React.useMemo(() => {
    const data = _.find(legacyDashboards, { name: dashboardName })?.data;

    return data?.rows?.length
      ? data.rows
      : data?.panels?.reduce((acc, panel) => {
          if (panel.type === 'row') {
            acc.push(_.cloneDeep(panel));
          } else if (acc.length === 0) {
            acc.push({ panels: [panel] });
          } else {
            const row = acc[acc.length - 1];
            if (_.isNil(row.panels)) {
              row.panels = [];
            }
            row.panels.push(panel);
          }
          return acc;
        }, []);
  }, [dashboardName, legacyDashboards]);

  return {
    persesAvailable,
    persesProjectsLoading,
    persesDashboards,
    legacyDashboardsError,
    legacyRows,
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
  project: string;
  tags: string[];
  title: string;
};
