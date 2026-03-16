import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { type FC } from 'react';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { DashboardList } from './dashboard-list';
import { ToastProvider } from './ToastProvider';

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
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardList />
        </ToastProvider>
      </QueryClientProvider>
    </QueryParamProvider>
  );
};

export default DashboardListPage;
