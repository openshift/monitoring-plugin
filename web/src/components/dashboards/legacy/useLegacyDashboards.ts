import * as _ from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { NumberParam, useQueryParam, useQueryParams } from 'use-query-params';
import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
} from '../../../store/actions';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';
import { useBoolean } from '../../hooks/useBoolean';
import { getLegacyDashboardsUrl, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';
import { ALL_NAMESPACES_KEY } from '../../utils';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { Board } from './types';
import {
  MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
  MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY,
} from './utils';

export const useLegacyDashboards = (namespace: string, urlBoard: string) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);
  const [unfilteredLegacyDashboards, setUnfilteredLegacyDashboards] = useState<any>([]);
  const [legacyDashboardsError, setLegacyDashboardsError] = useState<string>();
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);
  const [legacyDashboardsLoading, , , setLegacyDashboardsLoaded] = useBoolean(true);
  const [initialLoad, , , setInitialLoaded] = useBoolean(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [queryParams] = useQueryParams();

  useEffect(() => {
    safeFetch<any>('/api/console/monitoring-dashboard-config')
      .then((response) => {
        setLegacyDashboardsLoaded();
        setLegacyDashboardsError(undefined);
        setUnfilteredLegacyDashboards(response.items);
      })
      .catch((err) => {
        setLegacyDashboardsLoaded();
        if (err.name !== 'AbortError') {
          setLegacyDashboardsError(_.get(err, 'json.error', err.message));
        }
      });
  }, [safeFetch, setLegacyDashboardsLoaded]);

  // Move namespace filtering out of the fetch response call to avoid race conditions
  const legacyDashboards = useMemo<Board[]>(() => {
    let items = unfilteredLegacyDashboards;
    if (namespace && namespace !== ALL_NAMESPACES_KEY) {
      items = _.filter(
        items,
        (item) => item.metadata?.labels['console.openshift.io/odc-dashboard'] === 'true',
      );
    }
    const getBoardData = (item): Board => {
      try {
        return {
          data: JSON.parse(_.values(item.data)[0]),
          name: item.metadata.name,
        };
      } catch {
        setLegacyDashboardsError(
          t('Could not parse JSON data for dashboard "{{dashboard}}"', {
            dashboard: item.metadata.name,
          }),
        );
        return { data: undefined, name: item?.metadata?.name };
      }
    };
    return _.sortBy(_.map(items, getBoardData), (v) => _.toLower(v?.data?.title));
  }, [namespace, unfilteredLegacyDashboards, setLegacyDashboardsError, t]);
  const allVariablesCallback = useAllVariables(legacyDashboards, namespace);

  const legacyRows = useMemo(() => {
    const data = _.find(legacyDashboards, { name: urlBoard })?.data;

    return data?.rows?.length
      ? data.rows
      : (data?.panels?.reduce((acc, panel) => {
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
        }, []) ?? []);
  }, [urlBoard, legacyDashboards]);

  // Homogenize data needed for dashboards dropdown between legacy and perses dashboards
  // to enable both to use the same component
  const legacyDashboardsMetadata = useMemo<CombinedDashboardMetadata[]>(() => {
    if (legacyDashboardsLoading) {
      return [];
    }
    return legacyDashboards.map((legacyDashboard) => {
      return {
        name: legacyDashboard.name,
        tags: legacyDashboard.data?.tags,
        title: legacyDashboard.data?.title ?? legacyDashboard.name,
      };
    });
  }, [legacyDashboards, legacyDashboardsLoading]);

  const changeLegacyDashboard = useCallback(
    (newBoard: string, forceRefresh = false) => {
      if (!newBoard) {
        // If the board is being cleared then don't do anything
        return;
      }

      const params = new URLSearchParams(queryParams);

      const url = getLegacyDashboardsUrl(perspective, newBoard, namespace);

      if (newBoard !== urlBoard || forceRefresh) {
        if (!params.has(QueryParams.Dashboard) || params.get(QueryParams.Dashboard) !== newBoard) {
          params.set(QueryParams.Dashboard, newBoard);
          navigate(`${url}?${params.toString()}`, { replace: true });
        }

        dispatch(dashboardsPatchAllVariables(allVariablesCallback(newBoard)));

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
      refreshInterval,
      queryParams,
      allVariablesCallback,
    ],
  );

  useEffect(() => {
    if (
      (!urlBoard ||
        !legacyDashboards.some((legacyBoard) => legacyBoard.name === urlBoard) ||
        initialLoad) &&
      !_.isEmpty(legacyDashboards)
    ) {
      changeLegacyDashboard(urlBoard || legacyDashboards?.[0]?.name, initialLoad);
      setInitialLoaded();
    }
  }, [legacyDashboards, changeLegacyDashboard, initialLoad, setInitialLoaded, urlBoard]);

  useEffect(() => {
    if (initialLoad || _.isEmpty(legacyDashboards)) {
      return;
    }

    const currentBoard = urlBoard || legacyDashboards?.[0]?.name;
    if (currentBoard) {
      dispatch(dashboardsPatchAllVariables(allVariablesCallback(currentBoard)));
    }
  }, [namespace, legacyDashboards, urlBoard, dispatch, initialLoad, allVariablesCallback]);

  // Clear variables on unmount
  useEffect(() => {
    return () => {
      dispatch(DashboardsClearVariables());
    };
  }, [dispatch]);

  return {
    legacyDashboards,
    legacyDashboardsLoading,
    legacyDashboardsError,
    legacyRows,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard: urlBoard,
  };
};

const useAllVariables = (boards: Board[], namespace: string) => {
  const [params] = useQueryParams();

  return (newBoardName: string) => {
    const data = _.find(boards, { name: newBoardName })?.data;
    const allVariables = {};
    _.each(data?.templating?.list, (v) => {
      if (v.type === 'query' || v.type === 'interval') {
        // Look for query param that is equal to the variable name
        let value = params?.v.name;

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
          isHidden:
            v.name === 'namespace' && namespace !== ALL_NAMESPACES_KEY ? true : v.hide !== 0,
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
  };
};
