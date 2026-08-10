import { PrometheusEndpoint } from '@openshift-console/dynamic-plugin-sdk';
import { type FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/mcp-overview/components/summary/SummaryCard';
import { usePoll } from '@/shared/console/utils/poll-hook';
import { useSafeFetch } from '@/shared/console/utils/safe-fetch-hook';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import { getMutlipleQueryBrowserUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { PROMETHEUS_BASE_PATH } from '@/shared/utils/utils';

const POLL_INTERVAL = 15 * 1000;

const METRICS_URL = `${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.LABEL}/__name__/values`;

type LabelValuesResponse = {
  data?: string[];
};

type MetricsResults = {
  metricsCount: number;
  metricsLoading: boolean;
  metricsError?: string;
};

const MetricsSummaryCard: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();
  const [metricsResults, setMetricsResults] = useState<MetricsResults>({
    metricsCount: 0,
    metricsLoading: true,
  });

  const safeFetch = useSafeFetch();

  const tick = useCallback(() => {
    safeFetch<LabelValuesResponse>(METRICS_URL)
      .then((response) => {
        setMetricsResults({
          metricsCount: response?.data?.length ?? 0,
          metricsLoading: false,
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setMetricsResults({
            metricsCount: 0,
            metricsLoading: false,
            metricsError: err?.json?.error ?? err.message,
          });
        }
      });
  }, [safeFetch]);

  usePoll(tick, POLL_INTERVAL);

  return (
    <SummaryCard
      cardId="metrics"
      count={metricsResults.metricsCount}
      title={t('Metrics')}
      url={getMutlipleQueryBrowserUrl(perspective, new URLSearchParams(), namespace)}
      loading={metricsResults.metricsLoading}
      error={metricsResults.metricsError}
    />
  );
};

export default MetricsSummaryCard;
