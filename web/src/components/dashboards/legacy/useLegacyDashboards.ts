import { useCallback, useState, useMemo, useEffect } from 'react';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useSafeFetch } from '../../console/utils/safe-fetch-hook';

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
} from '../../../actions/observe';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { useNavigate } from 'react-router-dom-v5-compat';
import { Map as ImmutableMap } from 'immutable';
import { QueryParams } from '../../query-params';
import { NumberParam, StringParam, useQueryParam } from 'use-query-params';

export const useLegacyDashboards = (namespace: string, urlBoard: string) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);
  const [legacyDashboards, setLegacyDashboards] = useState<Board[]>([]);
  const [legacyDashboardsError, setLegacyDashboardsError] = useState<string>();
  const [dashboardParam] = useQueryParam(QueryParams.Dashboard, StringParam);
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);
  const [legacyDashboardsLoading, , , setLegacyDashboardsLoaded] = useBoolean(true);
  const [initialLoad, , , setInitialLoaded] = useBoolean(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const legacyDashboard = useMemo(() => {
    if (perspective === 'dev') {
      return dashboardParam;
    }
    return urlBoard;
  }, [perspective, dashboardParam, urlBoard]);

  useEffect(() => {
    safeFetch<any>('/api/console/monitoring-dashboard-config')
      .then((response) => {
        setLegacyDashboardsLoaded();
        setLegacyDashboardsError(undefined);
        let items = response.items;
        if (namespace) {
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
          } catch (e) {
            setLegacyDashboardsError(
              t('Could not parse JSON data for dashboard "{{dashboard}}"', {
                dashboard: item.metadata.name,
              }),
            );
            return { data: undefined, name: item?.metadata?.name };
          }
        };
        const newBoards = _.sortBy(_.map(items, getBoardData), (v) => _.toLower(v?.data?.title));
        setLegacyDashboards(newBoards);
      })
      .catch((err) => {
        setLegacyDashboardsLoaded();
        if (err.name !== 'AbortError') {
          setLegacyDashboardsError(_.get(err, 'json.error', err.message));
        }
      });
  }, [namespace, safeFetch, setLegacyDashboardsLoaded, t]);

  const legacyRows = useMemo(() => {
    const data = _.find(legacyDashboards, { name: legacyDashboard })?.data;

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
  }, [legacyDashboard, legacyDashboards]);

  useEffect(() => {
    // Dashboard query argument is only set in dev perspective, so skip for admin
    if (perspective !== 'dev') {
      return;
    }
    const allVariables = getAllVariables(legacyDashboards, legacyDashboard, namespace);
    dispatch(dashboardsPatchAllVariables(allVariables, perspective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, legacyDashboard]);

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
    (newBoard: string) => {
      if (!newBoard) {
        // If the board is being cleared then don't do anything
        return;
      }

      const allVariables = getAllVariables(legacyDashboards, newBoard, namespace);

      const queryArguments = getAllQueryArguments();
      const params = new URLSearchParams(queryArguments);

      let url = getLegacyDashboardsUrl(perspective, newBoard, namespace);
      url = `${url}${perspective === 'dev' ? '&' : '?'}${params.toString()}`;

      if (newBoard !== legacyDashboard || initialLoad) {
        if (params.get(QueryParams.Dashboard) !== newBoard) {
          navigate(url, { replace: true });
        }

        dispatch(dashboardsPatchAllVariables(allVariables, perspective));

        // Set time range and poll interval options to their defaults or from the query params if
        // available
        if (refreshInterval !== undefined) {
          dispatch(dashboardsSetPollInterval(_.toNumber(refreshInterval), perspective));
        }
        dispatch(
          dashboardsSetEndTime(_.toNumber(params.get(QueryParams.EndTime)) || null, perspective),
        );
        dispatch(
          dashboardsSetTimespan(
            _.toNumber(params.get(QueryParams.TimeRange)) || MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
            perspective,
          ),
        );
      }
    },
    [
      perspective,
      legacyDashboard,
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
      (!legacyDashboard ||
        !legacyDashboards.some((legacyBoard) => legacyBoard.name === legacyDashboard) ||
        initialLoad) &&
      !_.isEmpty(legacyDashboards)
    ) {
      changeLegacyDashboard(legacyDashboard || legacyDashboards?.[0]?.name);
      setInitialLoaded();
    }
  }, [legacyDashboards, changeLegacyDashboard, initialLoad, setInitialLoaded, legacyDashboard]);

  // Clear variables on unmount
  useEffect(() => {
    return () => {
      dispatch(DashboardsClearVariables(perspective));
    };
  }, [perspective, dispatch]);

  return {
    legacyDashboards,
    legacyDashboardsLoading,
    legacyDashboardsError,
    legacyRows,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard,
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

      allVariables[v.name] = ImmutableMap({
        datasource: v.datasource,
        includeAll: !!v.includeAll,
        isHidden: namespace && v.name === 'namespace' ? true : v.hide !== 0,
        isLoading: namespace ? v.type === 'query' && !namespace : v.type === 'query',
        options: _.map(v.options, 'value'),
        query: v.type === 'query' ? v.query : undefined,
        value: namespace && v.name === 'namespace' ? namespace : value || v.options?.[0]?.value,
      });
    }
  });

  return allVariables;
};
