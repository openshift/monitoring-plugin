import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { ProjectEmptyState } from '@/features/perses-dashboards/components/emptystates/ProjectEmptyState';
import { ToastProvider } from '@/features/perses-dashboards/components/ToastProvider';
import { useDashboardsData } from '@/features/perses-dashboards/hooks/useDashboardsData';
import { OCPDashboardApp } from '@/features/perses-dashboards/pages/dashboard-page/DashboardApp';
import { DashboardFrame } from '@/features/perses-dashboards/pages/dashboard-page/DashboardFrame';
import { LoadingInline } from '@/shared/console/console-shared/src/components/loading/LoadingInline';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';
import '@/features/perses-dashboards/pages/dashboard-page/dashboard-page.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    },
  },
});

const DashboardPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [searchParams] = useSearchParams();

  const {
    activeProjectDashboardsMetadata,
    changeBoard,
    dashboardName,
    setActiveProject,
    activeProject,
    combinedInitialLoad,
  } = useDashboardsData();

  // Get dashboard and project from URL parameters
  const urlDashboard = searchParams.get('dashboard');
  const urlProject = searchParams.get('project');

  // Set active project if provided in URL
  if (urlProject && urlProject !== activeProject) {
    setActiveProject(urlProject);
  }

  useEffect(() => {
    if (urlDashboard && urlDashboard !== dashboardName) {
      changeBoard(urlDashboard);
    }
  }, [urlDashboard, dashboardName, changeBoard]);

  if (combinedInitialLoad) {
    return <LoadingInline />;
  }

  if (activeProjectDashboardsMetadata?.length === 0) {
    return <ProjectEmptyState />;
  }

  // Find the dashboard that matches either the URL parameter or the current dashboardName
  const targetDashboardName = urlDashboard || dashboardName;
  const currentDashboard = activeProjectDashboardsMetadata.find(
    (d) => d.name === targetDashboardName,
  );

  if (!currentDashboard) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>{t('Dashboard not found')}</h2>
        <p>
          {t('The dashboard "{{name}}" was not found in project "{{project}}".', {
            name: targetDashboardName,
            project: activeProject || urlProject,
          })}
        </p>
      </div>
    );
  }

  return (
    <DashboardFrame
      activeProject={activeProject}
      activeProjectDashboardsMetadata={activeProjectDashboardsMetadata}
      dashboardDisplayName={currentDashboard.title}
    >
      <OCPDashboardApp
        dashboardResource={currentDashboard.persesDashboard}
        isReadonly={false}
        isVariableEnabled={true}
        isDatasourceEnabled={false}
        emptyDashboardProps={{
          title: t('Empty Dashboard'),
          description: t('To get started add something to your dashboard'),
        }}
      />
    </DashboardFrame>
  );
};

const DashboardPage: FC = () => {
  return (
    <QueryParamProvider adapter={ReactRouter7Adapter}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardPage_ />
        </ToastProvider>
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default DashboardPage;
