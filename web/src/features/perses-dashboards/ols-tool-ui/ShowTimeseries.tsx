import { Panel } from '@perses-dev/dashboards';
import { DataQueriesProvider } from '@perses-dev/plugin-system';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { AddToDashboardButton } from '@/features/perses-dashboards/ols-tool-ui/helpers/AddToDashboardButton';
import { OlsToolUIPersesWrapper } from '@/features/perses-dashboards/ols-tool-ui/helpers/OlsToolUIPersesWrapper';
import { useTimeRange } from '@/features/perses-dashboards/ols-tool-ui/helpers/useTimeRange';

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

export const ShowTimeseries: FC<{ tool: ShowTimeseriesTool }> = ({ tool }) => {
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
      <OlsToolUIPersesWrapper initialTimeRange={timeRange} initialTimeZone="UTC">
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
