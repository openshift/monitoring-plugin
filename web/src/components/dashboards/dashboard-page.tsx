import * as _ from 'lodash-es';
import { Overview, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { useSelector } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../console/console-shared/error/error-boundary';
import ErrorAlert from '../console/console-shared/alerts/error';
import { LoadingInline } from '../console/utils/status-box';

import { useFetchDashboards } from './legacy/useFetchDashboards';
import { getObserveState, usePerspective } from '../hooks/usePerspective';
import { Board } from './dashboard-stuff';
import DashboardSkeleton from './shared/dashboard-skeleton';
import { MonitoringState } from 'src/reducers/observe';
import { usePerses } from './perses/usePerses';
import { PersesBoard } from './perses/perses-dashboards';
import { NamespaceBar } from '../console/console-shared/namespace/NamespaceBar';
import { LEGACY_DASHBOARD_KEY } from '../console/console-shared/namespace/utils/utils';

type MonitoringDashboardsPageProps = RouteComponentProps<{ board: string; ns?: string }>;

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ match }) => {
  const [namespace] = useActiveNamespace();
  const isPerses = namespace !== LEGACY_DASHBOARD_KEY;
  const { perspective } = usePerspective();
  const board = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'name']),
  );

  const [boards, isLoading, error] = useFetchDashboards(namespace);
  const { getPersesDashboards, dashboardsData: persesDashboards } = usePerses();

  // Called only once on mount
  React.useEffect(() => {
    getPersesDashboards();
  }, [getPersesDashboards]);

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
      <NamespaceBar />
      <DashboardSkeleton urlBoard={match.params.board} boards={boards} boardItems={boardItems}>
        <Overview>
          {isLoading ? (
            <LoadingInline />
          ) : isPerses ? (
            <PersesBoard board={board} perspective={perspective} />
          ) : (
            <Board key={board} rows={rows} perspective={perspective} />
          )}
        </Overview>
      </DashboardSkeleton>
    </>
  );
};
const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPage_);

export default withFallback(MonitoringDashboardsPage);
