import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VariableProvider } from '@perses-dev/dashboards';
import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import { TimeZoneProvider } from '@perses-dev/components';
import type { DurationString, TimeRangeValue } from '@perses-dev/core';

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
  initialTimeRange?: TimeRangeValue;
  initialTimeZone?: string;
}

export const OlsToolUIPersesWrapper: React.FC<OlsToolUIPersesWrapperProps> = ({
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
