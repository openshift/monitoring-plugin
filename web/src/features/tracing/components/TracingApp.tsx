import { ReactNode } from 'react';
import { QueryParamProvider } from 'use-query-params';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactRouterAdapter } from './react_router_adapter';

interface TracingAppProps {
  children: ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});

/**
 * TracingApp is the common entrypoint for all Distributed Tracing UI pages.
 * It initializes @tanstack/react-query and use-query-params.
 */
export function TracingApp({ children }: TracingAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryParamProvider adapter={ReactRouterAdapter}>{children}</QueryParamProvider>
    </QueryClientProvider>
  );
}
