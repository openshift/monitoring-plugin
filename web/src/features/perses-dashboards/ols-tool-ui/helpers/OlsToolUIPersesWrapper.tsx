import { TimeZoneProvider } from '@perses-dev/components';
import type { DurationString, TimeRangeValue } from '@perses-dev/core';
import { VariableProvider } from '@perses-dev/dashboards';
import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC, ReactNode } from 'react';

import {
  PersesPrometheusDatasourceWrapper,
  PersesWrapper,
} from '@/features/perses-dashboards/components/PersesWrapper';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    },
  },
});

export interface OlsToolUIPersesWrapperProps {
  children: ReactNode;
  height?: string;
  initialTimeRange?: TimeRangeValue;
  initialTimeZone?: string;
}

export const OlsToolUIPersesWrapper: FC<OlsToolUIPersesWrapperProps> = ({
  children,
  initialTimeRange = { pastDuration: '1h' as DurationString },
  height = '300px',
  initialTimeZone = 'UTC',
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <PersesWrapper project={null}>
        <TimeZoneProvider timeZone={initialTimeZone}>
          <TimeRangeProviderBasic initialTimeRange={initialTimeRange}>
            <VariableProvider>
              <PersesPrometheusDatasourceWrapper queries={[]}>
                <div style={{ width: '100%', height: height }}>{children}</div>
              </PersesPrometheusDatasourceWrapper>
            </VariableProvider>
          </TimeRangeProviderBasic>
        </TimeZoneProvider>
      </PersesWrapper>
    </QueryClientProvider>
  );
};
