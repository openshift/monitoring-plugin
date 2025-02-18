import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../console/console-shared/error/error-boundary';
import ErrorAlert from '../console/console-shared/alerts/error';
import { LoadingInline } from '../console/utils/status-box';

import { LegacyDashboard } from './legacy/legacy-dashboard';
import DashboardSkeleton from './shared/dashboard-skeleton';
import { PersesBoard } from './perses/perses-dashboards';
import { ProjectBar } from './perses/project/ProjectBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LEGACY_DASHBOARDS_KEY } from './perses/project/utils';
import { useDashboardsData } from './shared/useDashboardsData';
import { usePerspective } from '../hooks/usePerspective';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      refetchInterval: 5 * 1000,
    },
  },
});

type MonitoringDashboardsPageProps = {
  urlBoard: string;
  namespace?: string;
};

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({
  urlBoard,
  namespace, // only used in developer perspective
}) => {
  const {
    persesAvailable,
    legacyDashboardsError,
    dashboardName,
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedIntialLoad,
    activeProject,
    setActiveProject,
    legacyRows,
  } = useDashboardsData(namespace, urlBoard);
  // if namespace is active everything should short circuit and just use the legacy stuff
  const { perspective } = usePerspective();

  return (
    <>
      {perspective !== 'dev' && (
        <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      )}
      <DashboardSkeleton
        urlBoard={urlBoard}
        boardItems={activeProjectDashboardsMetadata}
        changeBoard={changeBoard}
      >
        <Overview>
          {combinedIntialLoad ? (
            <LoadingInline />
          ) : persesAvailable && activeProject !== LEGACY_DASHBOARDS_KEY ? (
            <PersesBoard dashboardName={dashboardName} perspective={perspective} />
          ) : legacyDashboardsError ? (
            <ErrorAlert message={legacyDashboardsError} />
          ) : (
            <LegacyDashboard key={dashboardName} rows={legacyRows} perspective={perspective} />
          )}
        </Overview>
      </DashboardSkeleton>
    </>
  );
};

type MonitoringDashboardsWrapperProps = RouteComponentProps<{ dashboardName: string; ns?: string }>;

const MonitoringDashboardsPageWrapper: React.FC<MonitoringDashboardsWrapperProps> = ({ match }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringDashboardsPage_
        urlBoard={match.params.dashboardName}
        namespace={match.params?.ns}
      />
    </QueryClientProvider>
  );
};

const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPageWrapper);

export default withFallback(MonitoringDashboardsPage);
