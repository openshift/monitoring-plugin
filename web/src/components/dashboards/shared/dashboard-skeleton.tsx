import * as _ from 'lodash-es';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { getQueryArgument } from '../../console/utils/router';

import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsSetEndTime,
  dashboardsSetName,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  queryBrowserDeleteAllQueries,
} from '../../../actions/observe';
import { Board, MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../types';
import { getAllVariables } from '../monitoring-dashboard-utils';
import { getDeashboardsUrl, getObserveState, usePerspective } from '../../hooks/usePerspective';
import {
  AllVariableDropdowns,
  DashboardDropdown,
  HeaderTop,
  TimeDropdowns,
} from '../dashboard-stuff';
import { MonitoringState } from 'src/reducers/observe';

type MonitoringDashboardsPageProps = React.PropsWithChildren<{
  urlBoard: string;
  boardItems: any;
  boards: Board[];
}>;

const DashboardSkeleton: React.FC<MonitoringDashboardsPageProps> = ({
  children,
  urlBoard,
  boardItems,
  boards,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const history = useHistory();

  const dispatch = useDispatch();
  const [namespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const board = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'name']),
  );

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

        dispatch(dashboardsSetName(board, perspective));
      }
    },
    [perspective, board, boards, dispatch, history, namespace],
  );

  // Display dashboard present in the params or show the first board
  React.useEffect(() => {
    if (!board && !_.isEmpty(boards)) {
      const boardName = getQueryArgument('dashboard');
      changeBoard((namespace ? boardName : urlBoard) || boards?.[0]?.name);
    }
  }, [board, boards, changeBoard, urlBoard, namespace]);

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
      {children}
    </>
  );
};

export default DashboardSkeleton;
