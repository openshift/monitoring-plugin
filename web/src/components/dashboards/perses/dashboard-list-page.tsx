import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type FC } from 'react';
import { QueryParamProvider } from 'use-query-params';
import { DashboardList } from './dashboard-list';
import { ToastProvider } from './ToastProvider';
import { ReactRouter7Adapter } from '../../../react-router-7-adapter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const DashboardListPage: FC = () => {
  return (
    <QueryParamProvider adapter={ReactRouter7Adapter}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardList />
        </ToastProvider>
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default DashboardListPage;
