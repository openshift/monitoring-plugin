import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';
import { OCPDashboardApp } from './dashboard-app';
import { DashboardFrame } from './dashboard-frame';
import { ProjectEmptyState } from './emptystates/ProjectEmptyState';
import { useDashboardsData } from './hooks/useDashboardsData';
import { ToastProvider } from './ToastProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
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
      setActiveProject={setActiveProject}
      activeProjectDashboardsMetadata={activeProjectDashboardsMetadata}
      changeBoard={changeBoard}
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

const DashboardPage: React.FC = () => {
  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardPage_ />
        </ToastProvider>
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default DashboardPage;
