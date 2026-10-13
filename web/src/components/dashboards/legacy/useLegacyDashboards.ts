import * as _ from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router';
import { dashboardsPatchAllVariables } from '../../../store/actions';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';
import { useBoolean } from '../../hooks/useBoolean';
import { getLegacyDashboardsUrl, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';
import { ALL_NAMESPACES_KEY } from '../../utils';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { Board } from './types';
import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from './utils';
import { useLegacyDashboardsProject } from './useLegacyDashboardsProject';

export const useLegacyDashboards = (urlBoard: string) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();
  const { project } = useLegacyDashboardsProject(urlBoard);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);
  const [unfilteredLegacyDashboards, setUnfilteredLegacyDashboards] = useState<any>([]);
  const [legacyDashboardsError, setLegacyDashboardsError] = useState<string>();
  const [legacyDashboardsLoading, , , setLegacyDashboardsLoaded] = useBoolean(true);
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
    ({ newBoard, newProject }: { newBoard?: string; newProject?: string }) => {
      const dashboardProject = newProject ? newProject : project;
      // If no new dashboard is specified use the current dashboard name unless
      // the project is changing to "All Namespaces"
      let dashboardName = newBoard;
      if (!newBoard && newProject === ALL_NAMESPACES_KEY) {
        dashboardName = undefined;
      } else if (!newBoard) {
        dashboardName = urlBoard;
      }

      const url = getLegacyDashboardsUrl(perspective, dashboardName, dashboardProject);

      const params = new URLSearchParams();
      if (perspective === 'dev') {
        params.set(QueryParams.Dashboard, queryParams.get(QueryParams.Dashboard));
        if (
          !params.has(QueryParams.Dashboard) ||
          params.get(QueryParams.Dashboard) !== dashboardName
        ) {
          params.set(QueryParams.Dashboard, dashboardName);
        }
      } else {
        if (params.get(QueryParams.OpenshiftProject) !== ALL_NAMESPACES_KEY) {
          params.delete(QueryParams.Namespace);
        }
        params.set(QueryParams.OpenshiftProject, dashboardProject);
      }
      const srt = `${url}?${params.toString()}`;
      navigate(srt, { replace: true });

      dispatch(
        dashboardsPatchAllVariables(
          dashboardName,
          getAllVariables(params, legacyDashboards, dashboardProject, dashboardName),
        ),
      );
    },
    [perspective, urlBoard, dispatch, navigate, project, queryParams, legacyDashboards],
  );

  const previousProject = useRef(project);
  useEffect(() => {
    let replacementBoard = urlBoard;
    if (
      !urlBoard ||
      (!legacyDashboards.some((legacyBoard) => legacyBoard.name === urlBoard) &&
        !_.isEmpty(legacyDashboards))
    ) {
      replacementBoard = legacyDashboards?.[0]?.name;
    }
    if (urlBoard !== replacementBoard || project !== previousProject.current) {
      previousProject.current = project;
      changeLegacyDashboard({
        newBoard: replacementBoard,
        newProject: project,
      });
    }
  }, [legacyDashboards, changeLegacyDashboard, urlBoard, project]);

  useEffect(() => {
    if (_.isEmpty(legacyDashboards)) {
      return;
    }

    const currentBoard = urlBoard || legacyDashboards?.[0]?.name;
    if (currentBoard) {
      dispatch(
        dashboardsPatchAllVariables(
          currentBoard,
          getAllVariables(queryParams, legacyDashboards, project, currentBoard),
        ),
      );
    }
  }, [project, legacyDashboards, urlBoard, dispatch, queryParams]);

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
