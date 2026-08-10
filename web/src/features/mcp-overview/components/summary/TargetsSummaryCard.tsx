import { PrometheusEndpoint } from '@openshift-console/dynamic-plugin-sdk';
import { type FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/mcp-overview/components/summary/SummaryCard';
import { usePoll } from '@/shared/console/utils/poll-hook';
import { useSafeFetch } from '@/shared/console/utils/safe-fetch-hook';
import { PROMETHEUS_BASE_PATH } from '@/shared/utils/utils';

const POLL_INTERVAL = 15 * 1000;

const TARGETS_URL = `${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.TARGETS}?state=active`;

type PrometheusTargetsResponse = {
  data?: {
    activeTargets?: unknown[];
  };
};

type TargetResults = {
  targetsCount: number;
  targetsLoading: boolean;
  targetsError?: string;
};

const TargetsSummaryCard: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [targetResults, setTargetResults] = useState<TargetResults>({
    targetsCount: 0,
    targetsLoading: true,
  });

  const safeFetch = useSafeFetch();

  const tick = useCallback(() => {
    safeFetch<PrometheusTargetsResponse>(TARGETS_URL)
      .then((response) => {
        setTargetResults({
          targetsCount: response?.data?.activeTargets?.length ?? 0,
          targetsLoading: false,
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setTargetResults({
            targetsCount: 0,
            targetsLoading: false,
            targetsError: err.json?.error ?? err.message,
          });
        }
      });
  }, [safeFetch]);

  usePoll(tick, POLL_INTERVAL);

  return (
    <SummaryCard
      cardId="targets"
      count={targetResults.targetsCount}
      title={t('Targets')}
      url="/monitoring/targets"
      loading={targetResults.targetsLoading}
      error={targetResults.targetsError}
    />
  );
};

export default TargetsSummaryCard;
