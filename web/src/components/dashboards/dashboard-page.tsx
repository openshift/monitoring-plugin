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
import { ProjectBar } from './perses/project/ProjectBar';
import { LEGACY_DASHBOARDS_KEY } from './perses/project/utils/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      // TODO: Consider if it's possible to link this the refresh interval, which is down 2 layers
      // in the timespan-dropdown. Or maybe its already in the store
      refetchInterval: 5 * 1000,
    },
  },
});

type MonitoringDashboardsPageProps = {
  urlBoard: string;
};

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ urlBoard }) => {
  const [namespace] = useActiveNamespace();
  const isPerses = namespace !== LEGACY_DASHBOARDS_KEY;
  const { perspective } = usePerspective();
  const board = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'name']),
  );

  const [boards, isLoading, error] = useFetchDashboards(namespace);
  const { getDashboards, dashboards } = usePerses();

  // Called only once on mount
  React.useEffect(() => {
    getDashboards();
  }, [getDashboards]);

  const boardItems = React.useMemo(() => {
    const ocpBoardItems = _.mapValues(_.mapKeys(boards, 'name'), (b, name) => ({
      tags: b.data?.tags,
      title: b.data?.title ?? name,
    }));

    if (dashboards) {
      const persesKeys = _.mapKeys(dashboards, function (item) {
        return item?.metadata?.name;
      });
      const persesBoardItems = _.mapValues(persesKeys, (b) => ({
        tags: ['perses'],
        title: `${b.metadata?.project} / ${b.metadata?.name}`,
      }));
      return { ...persesBoardItems, ...ocpBoardItems };
    }
    return ocpBoardItems;
  }, [boards, dashboards]);

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
      <ProjectBar />
      <DashboardSkeleton urlBoard={urlBoard} boards={boards} boardItems={boardItems}>
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

type MonitoringDashboardsWrapperProps = RouteComponentProps<{ board: string; ns?: string }>;

const MonitoringDashboardsPageWrapper: React.FC<MonitoringDashboardsWrapperProps> = ({ match }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringDashboardsPage_ urlBoard={match.params.board} />
    </QueryClientProvider>
  );
};

const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPageWrapper);

export default withFallback(MonitoringDashboardsPage);
