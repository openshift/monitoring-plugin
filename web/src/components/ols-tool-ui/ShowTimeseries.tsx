import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataQueriesProvider } from '@perses-dev/plugin-system';
import { Panel } from '@perses-dev/dashboards';

import { OlsToolUIPersesWrapper } from './helpers/OlsToolUIPersesWrapper';
import { AddToDashboardButton } from './helpers/AddToDashboardButton';
import { useTimeRange } from './helpers/useTimeRange';

type ShowTimeseriesTool = {
  args: {
    title: string;
    description: string;
    query: string;
    start?: string;
    end?: string;
    duration?: string;
  };
};

export const ShowTimeseries: React.FC<{ tool: ShowTimeseriesTool }> = ({ tool }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { query, title, description, start, end, duration } = tool.args;
  const timeRange = useTimeRange(start, end, duration);
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
      <OlsToolUIPersesWrapper initialTimeRange={timeRange}>
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
