import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../../console/console-shared/error/error-boundary';
import { LoadingInline } from '../../console/utils/status-box';

import DashboardSkeleton from '../shared/dashboard-skeleton';
import { PersesWrapper } from './PersesWrapper';

import PersesBoard from './perses-dashboards';
import { ProjectBar } from './project/ProjectBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardsData } from './hooks/useDashboardsData';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { DashboardEmptyState } from './emptystates/DashboardEmptyState';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});

type MonitoringDashboardsPageProps = {
  urlBoard: string;
};

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ urlBoard }) => {
  const {
    changeBoard,
    activeProjectDashboardsMetadata,
    combinedIntialLoad,
    activeProject,
    setActiveProject,
  } = useDashboardsData(urlBoard);

  if (combinedIntialLoad) {
    return <LoadingInline />;
  }

  if (!activeProject) {
    // If we have loaded all of the requests fully and there are no projects, then
    return <ProjectEmptyState />; // empty state
  }

  return (
    <PersesWrapper project={activeProject}>
      <ProjectBar activeProject={activeProject} setActiveProject={setActiveProject} />
      {activeProjectDashboardsMetadata.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <DashboardSkeleton
          boardItems={activeProjectDashboardsMetadata}
          changeBoard={changeBoard}
          isPerses={true}
        >
          <Overview>
            <PersesBoard />
          </Overview>
        </DashboardSkeleton>
      )}
    </PersesWrapper>
  );
};

type MonitoringDashboardsWrapperProps = RouteComponentProps<{ dashboardName: string; ns?: string }>;

const MonitoringDashboardsPageWrapper: React.FC<MonitoringDashboardsWrapperProps> = ({ match }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringDashboardsPage_ urlBoard={match?.params?.dashboardName} />
    </QueryClientProvider>
  );
};

const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPageWrapper);

export default withFallback(MonitoringDashboardsPage);
