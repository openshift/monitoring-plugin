import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataQueriesProvider } from '@perses-dev/plugin-system';
import type { DurationString } from '@perses-dev/prometheus-plugin';
import { Panel } from '@perses-dev/dashboards';

import { OlsToolUIPersesWrapper } from './helpers/OlsToolUIPersesWrapper';
import { AddToDashboardButton } from './helpers/AddToDashboardButton';

type ExecuteRangeQueryTool = {
  args: {
    title: string;
    description: string;
    query: string;
  };
};

const persesTimeRange = {
  pastDuration: '1h' as DurationString,
};

export const ShowTimeseries: React.FC<{ tool: ExecuteRangeQueryTool }> = ({ tool }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { query, title, description } = tool.args;
  const queryDescription = t('Query: {{query}}', { query: query });
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
              extra: () => (
                <AddToDashboardButton query={query} name={title} description={description} />
              ),
            }}
            definition={{
              kind: 'Panel',
              spec: {
                queries: [],
                display: { name: title, description: `${description}\n\n${queryDescription}` },
                plugin: {
                  kind: 'TimeSeriesChart',
                  spec: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                },
              },
            }}
          />
        </DataQueriesProvider>
      </OlsToolUIPersesWrapper>
    </>
  );
};

export default ShowTimeseries;
