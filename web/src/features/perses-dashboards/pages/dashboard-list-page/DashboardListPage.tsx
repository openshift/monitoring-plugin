import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type FC } from 'react';

import { ToastProvider } from '@/features/perses-dashboards/components/ToastProvider';
import { DashboardList } from '@/features/perses-dashboards/pages/dashboard-list-page/DashboardList';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      keepPreviousData: true,
    },
  },
});

const DashboardListPage: FC = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardList />
        </ToastProvider>
      </QueryClientProvider>
    </MonitoringProvider>
  );
};

export default DashboardListPage;
