import { useCallback, useMemo, useEffect } from 'react';
import * as _ from 'lodash-es';
import { TFunction, useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useBoolean } from '../../hooks/useBoolean';
import { Board } from './types';
import { getLegacyDashboardsUrl, usePerspective } from '../../hooks/usePerspective';
import { getAllQueryArguments, getQueryArgument } from '../../console/utils/router';
import {
  MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
  MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY,
} from './utils';
import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
} from '../../../store/actions';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { useNavigate } from 'react-router-dom-v5-compat';
import { QueryParams } from '../../query-params';
import { NumberParam, useQueryParam } from 'use-query-params';
import { ALL_NAMESPACES_KEY } from '../../utils';
import {
  consoleFetchJSON,
  K8sResourceCommon,
  ObjectMetadata,
} from '@openshift-console/dynamic-plugin-sdk';
import { useQuery, UseQueryResult } from '@tanstack/react-query';

type DashboardConfigMap = { data: Record<string, string>; metadata: ObjectMetadata };
type DashboardConfigMapList = K8sResourceCommon & { items: DashboardConfigMap[] };

function getDashboardConfig(): Promise<DashboardConfigMapList> {
  return consoleFetchJSON('/api/console/monitoring-dashboard-config');
}

export function useDashboardConfig(): UseQueryResult<DashboardConfigMapList> {
  return useQuery<DashboardConfigMapList>({
    queryKey: ['monitoring-dashboard-config'],
    queryFn: () => {
      return getDashboardConfig();
    },
  });
}

const getBoardData = (item: DashboardConfigMap, t: TFunction): { board: Board; error?: string } => {
  let dashboardError: string;
  try {
    return {
      board: {
        data: JSON.parse(_.values(item.data)[0]),
        name: item.metadata.name,
      },
    };
  } catch {
    dashboardError = t('Could not parse JSON data for dashboard "{{dashboard}}"', {
      dashboard: item.metadata.name,
    });
    return { board: { data: undefined, name: item?.metadata?.name }, error: dashboardError };
  }
};

function getBoards(
  dashboardsConfig: DashboardConfigMapList,
  dashboardsLoading: boolean,
  namespace: string,
  t: TFunction,
): { boards: Board[]; dashboardsLoading: boolean; dashboardError?: string } {
  if (dashboardsLoading) {
    return {
      boards: [],
      dashboardsLoading: true,
    };
  }
  let items = dashboardsConfig.items;
  if (namespace && namespace !== ALL_NAMESPACES_KEY) {
    items = items.filter(
      (item) => item.metadata?.labels['console.openshift.io/odc-dashboard'] === 'true',
    );
  }

  const convertedBoards = items.map((item) => getBoardData(item, t));
  const dashboardError = convertedBoards.find((convertedBoard) => convertedBoard?.error)?.error;
  const boards = convertedBoards.map((convertedBoard) => convertedBoard.board);

  return {
    boards: boards.sort((a: Board, b: Board) =>
      a?.data?.title.toLowerCase() >= b?.data?.title.toLowerCase() ? 1 : 0,
    ),
    dashboardsLoading: false,
    dashboardError,
  };
}

function getSelectedDashboardRows(name: string, boards: Board[]) {
  const selectedDashboard = boards.find((board) => board.name === name)?.data;
  if (!selectedDashboard) {
    return [];
  }

  if (selectedDashboard?.rows?.length > 0) {
    return selectedDashboard.rows;
  }

  if (selectedDashboard?.panels?.length > 0) {
    return selectedDashboard?.panels?.reduce((acc, panel) => {
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
  }

  // No values if there are no rows or panels
  return [];
}

export const useLegacyDashboards = (namespace: string, urlBoard: string) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();

  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);
  const [initialLoad, , setInitialUnloaded, setInitialLoaded] = useBoolean(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { isLoading: dashboardConfigLoading, data: dashboardConfig } = useDashboardConfig();

  // Move namespace filtering out of the fetch response call to avoid race conditions
  const legacyDashboards = useMemo(() => {
    return getBoards(dashboardConfig, dashboardConfigLoading, namespace, t);
  }, [namespace, t, dashboardConfig, dashboardConfigLoading]);

  const legacyRows = useMemo(() => {
    return getSelectedDashboardRows(urlBoard, legacyDashboards.boards);
  }, [urlBoard, legacyDashboards.boards]);

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const legacyDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (legacyDashboards.dashboardsLoading) {
      return [];
    }
    return legacyDashboards.boards.map((legacyDashboard) => {
      return {
        name: legacyDashboard.name,
        tags: legacyDashboard.data?.tags,
        title: legacyDashboard.data?.title ?? legacyDashboard.name,
      };
    });
  }, [legacyDashboards]);

  const changeLegacyDashboard = useCallback(
    (newBoard: string) => {
      if (!newBoard) {
        // If the board is being cleared then don't do anything
        return;
      }

      const allVariables = getAllVariables(legacyDashboards.boards, newBoard, namespace);

      const queryArguments = getAllQueryArguments();
      const params = new URLSearchParams(queryArguments);

      const url = `${getLegacyDashboardsUrl(perspective, newBoard)}?${params.toString()}`;

      if (newBoard !== urlBoard || initialLoad) {
        if (params.get(QueryParams.Dashboard) !== newBoard) {
          navigate(url, { replace: true });
        }

        dispatch(dashboardsPatchAllVariables(allVariables));

        // Set time range and poll interval options to their defaults or from the query params if
        // available
        if (refreshInterval !== undefined) {
          dispatch(dashboardsSetPollInterval(_.toNumber(refreshInterval)));
        }
        dispatch(dashboardsSetEndTime(_.toNumber(params.get(QueryParams.EndTime)) || null));
        dispatch(
          dashboardsSetTimespan(
            _.toNumber(params.get(QueryParams.TimeRange)) || MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
          ),
        );
      }
    },
    [
      perspective,
      urlBoard,
      dispatch,
      navigate,
      namespace,
      legacyDashboards,
      initialLoad,
      refreshInterval,
    ],
  );

  useEffect(() => {
    if (
      (!urlBoard ||
        !legacyDashboards.boards.some((legacyBoard) => legacyBoard.name === urlBoard) ||
        initialLoad) &&
      !_.isEmpty(legacyDashboards)
    ) {
      changeLegacyDashboard(urlBoard || legacyDashboards?.[0]?.name);
      setInitialLoaded();
    }
  }, [legacyDashboards, changeLegacyDashboard, initialLoad, setInitialLoaded, urlBoard]);

  useEffect(() => {
    // Basically perform a full reload when changing a namespace to force the variables and the
    // dashboard to reset. This is needed for when we transition between ALL_NS and a normal
    // namespace, but is performed quickly and should help insure consistency when transitioning
    // between any namespaces
    setInitialUnloaded();
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [namespace]);

  // Clear variables on unmount
  useEffect(() => {
    return () => {
      dispatch(DashboardsClearVariables());
    };
  }, [dispatch]);

  return {
    legacyDashboards,
    legacyRows,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard: urlBoard,
  };
};

const getAllVariables = (boards: Board[], newBoardName: string, namespace: string) => {
  const data = _.find(boards, { name: newBoardName })?.data;

  const allVariables = {};
  _.each(data?.templating?.list, (v) => {
    if (v.type === 'query' || v.type === 'interval') {
      // Look for query param that is equal to the variable name
      let value = getQueryArgument(v.name);

      // Look for an option that should be selected by default
      if (value === null) {
        value = _.find(v.options, { selected: true })?.value;
      }

      // If no default option was found, default to "All" (if present)
      if (value === undefined && v.includeAll) {
        value = MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY;
      }

      allVariables[v.name] = {
        datasource: v.datasource,
        includeAll: !!v.includeAll,
        isHidden: v.name === 'namespace' && namespace !== ALL_NAMESPACES_KEY ? true : v.hide !== 0,
        isLoading: v.name === 'namespace' ? false : v.type === 'query',
        options: _.map(v.options, 'value'),
        query: v.type === 'query' ? v.query : undefined,
        value:
          v.name === 'namespace' && namespace !== ALL_NAMESPACES_KEY
            ? namespace
            : value || v.options?.[0]?.value,
      };
    }
  });

  return allVariables;
};
