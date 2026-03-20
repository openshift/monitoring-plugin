import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VariableProvider } from '@perses-dev/dashboards';
import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import type { DurationString } from '@perses-dev/prometheus-plugin';

import {
  PersesWrapper,
  PersesPrometheusDatasourceWrapper,
} from '../../dashboards/perses/PersesWrapper';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

interface OlsToolUIPersesWrapperProps {
  children: React.ReactNode;
  height?: string;
  initialTimeRange?: {
    pastDuration: DurationString;
  };
}

export const OlsToolUIPersesWrapper: React.FC<OlsToolUIPersesWrapperProps> = ({
  children,
  initialTimeRange = { pastDuration: '1h' as DurationString },
  height = '300px',
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <PersesWrapper project={null}>
        <TimeRangeProviderBasic initialTimeRange={initialTimeRange}>
          <VariableProvider>
            <PersesPrometheusDatasourceWrapper queries={[]}>
              <div style={{ width: '100%', height: height }}>{children}</div>
            </PersesPrometheusDatasourceWrapper>
          </VariableProvider>
        </TimeRangeProviderBasic>
      </PersesWrapper>
    </QueryClientProvider>
  );
};
