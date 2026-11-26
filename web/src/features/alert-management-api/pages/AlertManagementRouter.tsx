import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { matchPath, Navigate, useLocation } from 'react-router';

import { AlertManagementLayout } from '@/features/alert-management-api/components/layout/AlertManagementLayout';
import { AlertManagementAlertsPage } from '@/features/alert-management-api/pages/alerts-page/AlertsPage';
import { SilencesManagementPage } from '@/features/alert-management-api/pages/PlaceholderPages';
import { AlertRulesManagementPage } from '@/features/alert-management-api/pages/rules-page/RulesPage';
import {
  SilenceManagementCreatePage,
  SilenceManagementEditPage,
} from '@/features/alert-management-api/pages/silence-modify/SilenceModifyPages';
import { silencesPath } from '@/features/alert-management-api/utils/urls';
import { McpCmoAlertingPage } from '@/features/incidents/pages/IncidentsPage';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import type { MonitoringPlugins, Prometheus } from '@/shared/utils/utils';

const alertsPath = '/monitoring/v2/alerts';
const alertRulesPath = '/monitoring/v2/management/alertrules';
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

export function AlertManagementRouter() {
  const { pathname } = useLocation();
  if (matchPath(`${silencesPath}/~new`, pathname)) {
    return <SilenceManagementCreatePage />;
  }
  const editMatch = matchPath(`${silencesPath}/:id/edit`, pathname);
  if (editMatch) {
    return <SilenceManagementEditPage id={editMatch.params.id} />;
  }

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
      children = <McpCmoAlertingPage />;
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
