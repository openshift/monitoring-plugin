import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { AlertManagementLayout } from '@/features/alert-management-api/components/AlertManagementLayout';
import {
  AlertRulesManagementPage,
  IncidentsManagementPage,
  SilencesManagementPage,
} from '@/features/alert-management-api/pages//PlaceholderPages';
import { AlertManagementAlertsPage } from '@/features/alert-management-api/pages/alerts-page/AlertsPage';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import type { MonitoringPlugins, Prometheus } from '@/shared/utils/utils';

const alertsPath = '/monitoring/v2/alerts';
const alertRulesPath = '/monitoring/v2/management/alertrules';
const silencesPath = '/monitoring/v2/management/silences';
const incidentsPath = '/monitoring/v2/incidents';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false },
  },
});

export function AlertManagementProvider({
  children,
  monitoringContext = { plugin: 'monitoring-plugin', prometheus: 'cmo' },
}: {
  children: ReactNode;
  monitoringContext?: { plugin: MonitoringPlugins; prometheus: Prometheus };
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringProvider monitoringContext={monitoringContext}>{children}</MonitoringProvider>
    </QueryClientProvider>
  );
}

function AlertManagementRouter() {
  const { pathname } = useLocation();

  let children: ReactNode;
  switch (pathname) {
    case alertsPath:
      children = <AlertManagementAlertsPage />;
      break;
    case alertRulesPath:
      children = <AlertRulesManagementPage />;
      break;
    case silencesPath:
      children = <SilencesManagementPage />;
      break;
    case incidentsPath:
      children = <IncidentsManagementPage />;
      break;
    default:
      children = <Navigate to={alertsPath} replace />;
  }

  return <AlertManagementLayout>{children}</AlertManagementLayout>;
}

export function MpCmoAlertManagementRouter() {
  return (
    <AlertManagementProvider>
      <AlertManagementRouter />
    </AlertManagementProvider>
  );
}
