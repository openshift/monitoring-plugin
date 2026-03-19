import React from 'react';
import { DataQueriesProvider } from '@perses-dev/plugin-system';
import type { DurationString } from '@perses-dev/prometheus-plugin';
import { Panel } from '@perses-dev/dashboards';

import { OlsToolUIPersesWrapper } from './OlsToolUIPersesWrapper';
import { AddToDashboardButton } from './AddToDashboardButton';

type ExecuteRangeQueryTool = {
  name: 'execute_range_query';
  args: {
    query: string;
  };
};

const persesTimeRange = {
  pastDuration: '1h' as DurationString,
};

export const ExecuteRangeQuery: React.FC<{ tool: ExecuteRangeQueryTool }> = ({ tool }) => {
  const query = tool.args.query;
  const definitions = [
    {
      kind: 'PrometheusTimeSeriesQuery',
      spec: {
        query: query,
      },
    },
  ];

  return (
    <>
      <OlsToolUIPersesWrapper initialTimeRange={persesTimeRange}>
        <DataQueriesProvider
          definitions={definitions}
          options={{ suggestedStepMs: 15000, mode: 'range' }}
        >
          <Panel
            panelOptions={{
              hideHeader: false,
            }}
            definition={{
              kind: 'Panel',
              spec: {
                queries: [],
                display: { name: query },
                plugin: {
                  kind: 'TimeSeriesChart',
                  spec: {
                    visual: {
                      stack: 'all',
                    },
                  },
                },
              },
            }}
          />
        </DataQueriesProvider>
      </OlsToolUIPersesWrapper>
      <AddToDashboardButton query={query} />
    </>
  );
};

export default ExecuteRangeQuery;
