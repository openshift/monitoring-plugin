import * as _ from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router';
import { NumberParam, useQueryParam } from 'use-query-params';
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
import { useOpenshiftProject } from './useOpenshiftProject';

export const useLegacyDashboards = (urlBoard: string) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();
  const { project } = useOpenshiftProject();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);
  const [unfilteredLegacyDashboards, setUnfilteredLegacyDashboards] = useState<any>([]);
  const [legacyDashboardsError, setLegacyDashboardsError] = useState<string>();
  const [refreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);
  const [legacyDashboardsLoading, , , setLegacyDashboardsLoaded] = useBoolean(true);
  const [initialLoad, , , setInitialLoaded] = useBoolean(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [queryParams] = useSearchParams();

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
    if (project && project !== ALL_NAMESPACES_KEY) {
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
  }, [project, unfilteredLegacyDashboards, setLegacyDashboardsError, t]);

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
    ({
      newBoard,
      newProject,
      initialLoad = false,
    }: {
      newBoard?: string;
      newProject?: string;
      initialLoad?: boolean;
    }) => {
      const dashboardProject = newProject ? newProject : project;

      const url = getLegacyDashboardsUrl(perspective, newBoard, dashboardProject);

      let params: URLSearchParams;
      if (initialLoad) {
        params = new URLSearchParams(queryParams);
        if (perspective === 'dev') {
          params.delete(QueryParams.Namespace);
          params.delete(QueryParams.OpenshiftProject);
        }
      } else {
        params = new URLSearchParams();
      }

      if (newBoard !== urlBoard || newProject !== project || initialLoad) {
        if (
          perspective === 'dev' &&
          (!params.has(QueryParams.Dashboard) || params.get(QueryParams.Dashboard) !== newBoard)
        ) {
          params.set(QueryParams.Dashboard, newBoard);
        }
        if (perspective !== 'dev') {
          if (params.get(QueryParams.OpenshiftProject) !== ALL_NAMESPACES_KEY) {
            params.delete(QueryParams.Namespace);
          }
          params.set(QueryParams.OpenshiftProject, dashboardProject);
        }
        const srt = `${url}?${params.toString()}`;
        navigate(srt, { replace: true });

        dispatch(
          dashboardsPatchAllVariables(
            getAllVariables(params, legacyDashboards, dashboardProject, newBoard),
          ),
        );

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
      project,
      refreshInterval,
      queryParams,
      legacyDashboards,
    ],
  );

  useEffect(() => {
    if (
      (!urlBoard ||
        !legacyDashboards.some((legacyBoard) => legacyBoard.name === urlBoard) ||
        initialLoad) &&
      !_.isEmpty(legacyDashboards)
    ) {
      changeLegacyDashboard({
        newBoard: urlBoard || legacyDashboards?.[0]?.name,
        initialLoad: initialLoad,
        newProject: project,
      });
      setInitialLoaded();
    }
  }, [legacyDashboards, changeLegacyDashboard, initialLoad, setInitialLoaded, urlBoard, project]);

  useEffect(() => {
    if (initialLoad || _.isEmpty(legacyDashboards)) {
      return;
    }

    const currentBoard = urlBoard || legacyDashboards?.[0]?.name;
    if (currentBoard) {
      dispatch(
        dashboardsPatchAllVariables(
          getAllVariables(queryParams, legacyDashboards, project, currentBoard),
        ),
      );
    }
  }, [project, legacyDashboards, urlBoard, dispatch, initialLoad, queryParams]);

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

const getAllVariables = (
  params: URLSearchParams,
  boards: Board[],
  namespace: string,
  newBoardName: string,
) => {
  const data = _.find(boards, { name: newBoardName })?.data;
  const allVariables = {};
  _.each(data?.templating?.list, (v) => {
    if (v.type === 'query' || v.type === 'interval') {
      // Look for query param that is equal to the variable name
      let value = params.get(v.name);

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
