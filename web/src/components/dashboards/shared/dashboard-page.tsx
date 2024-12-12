import * as _ from 'lodash-es';
import { Overview, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../../console/console-shared/error/error-boundary';
import ErrorAlert from '../../console/console-shared/alerts/error';
import { getQueryArgument } from '../../console/utils/router';
import { LoadingInline } from '../../console/utils/status-box';

import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  queryBrowserDeleteAllQueries,
} from '../../../actions/observe';
import { MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../types';
import { useFetchDashboards } from '../legacy/useFetchDashboards';
import { getAllVariables } from '../monitoring-dashboard-utils';
import { getDeashboardsUrl, usePerspective } from '../../hooks/usePerspective';
import { usePerses } from '../perses/usePerses';
import {
  AllVariableDropdowns,
  Board,
  DashboardDropdown,
  HeaderTop,
  TimeDropdowns,
} from '../dashboard-stuff';

type MonitoringDashboardsPageProps = RouteComponentProps<{ board: string; ns?: string }>;

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ history, match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const dispatch = useDispatch();
  const [namespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const [board, setBoard] = React.useState<string>();
  const [boards, isLoading, error] = useFetchDashboards(namespace);
  const { getPersesDashboards, dashboardsData: persesDashboards } = usePerses();

  // Called only once on mount
  React.useEffect(() => {
    getPersesDashboards();
  }, [getPersesDashboards]);

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

  const boardItems = React.useMemo(() => {
    const ocpBoardItems = _.mapValues(_.mapKeys(boards, 'name'), (b, name) => ({
      tags: b.data?.tags,
      title: b.data?.title ?? name,
    }));

    if (persesDashboards) {
      const persesKeys = _.mapKeys(persesDashboards, function (item) {
        return item?.metadata?.name;
      });
      const persesBoardItems = _.mapValues(persesKeys, (b) => ({
        tags: ['perses'],
        title: `${b.metadata?.project} / ${b.metadata?.name}`,
      }));
      return { ...persesBoardItems, ...ocpBoardItems };
    }
    return ocpBoardItems;
  }, [boards, persesDashboards]);

  const changeBoard = React.useCallback(
    (newBoard: string) => {
      let timeSpan: string;
      let endTime: string;
      let url = getDeashboardsUrl(perspective, newBoard, namespace);

      const refreshInterval = getQueryArgument('refreshInterval');

      if (board) {
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
        // persist all query params on page reload
        if (window.location.search) {
          url = `${url}${window.location.search}`;
        }
      }
      if (newBoard !== board) {
        if (getQueryArgument('dashboard') !== newBoard) {
          history.replace(url);
        }

        const allVariables = getAllVariables(boards, newBoard, namespace);
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

        setBoard(newBoard);
      }
    },
    [perspective, board, boards, dispatch, history, namespace],
  );

  // Display dashboard present in the params or show the first board
  React.useEffect(() => {
    if (!board && !_.isEmpty(boards)) {
      const boardName = getQueryArgument('dashboard');
      changeBoard((namespace ? boardName : match.params.board) || boards?.[0]?.name);
    }
  }, [board, boards, changeBoard, match.params.board, namespace]);

  React.useEffect(() => {
    // Dashboard query argument is only set in dev perspective, so skip for admin
    if (perspective === 'admin') {
      return;
    }
    const newBoard = getQueryArgument('dashboard');
    const allVariables = getAllVariables(boards, newBoard, namespace);
    dispatch(dashboardsPatchAllVariables(allVariables, perspective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  // If we don't find any rows, build the rows array based on what we have in `data.panels`
  const rows = React.useMemo(() => {
    const data = _.find(boards, { name: board })?.data;

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
  }, [board, boards]);

  if (error) {
    return <ErrorAlert message={error} />;
  }

  return (
    <>
      {perspective !== 'dev' && (
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
      )}
      <div className="co-m-nav-title co-m-nav-title--detail">
        {perspective !== 'dev' && <HeaderTop />}
        <div className="monitoring-dashboards__variables">
          <div className="monitoring-dashboards__dropdowns">
            {!_.isEmpty(boardItems) && (
              <DashboardDropdown items={boardItems} onChange={changeBoard} selectedKey={board} />
            )}
            <AllVariableDropdowns key={board} />
          </div>
          {perspective === 'dev' && <TimeDropdowns />}
        </div>
      </div>
      <Overview>
        {isLoading ? (
          <LoadingInline />
        ) : (
          <Board key={board} rows={rows} perspective={perspective} />
        )}
      </Overview>
    </>
  );
};
const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPage_);

export default withFallback(MonitoringDashboardsPage);
