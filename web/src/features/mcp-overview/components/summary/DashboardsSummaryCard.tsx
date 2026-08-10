import { useQuery } from '@tanstack/react-query';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/mcp-overview/components/summary/SummaryCard';
import { getDashboardsListUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { fetchPersesDashboardsMetadata } from '@/shared/utils/perses-client';

const REFRESH_INTERVAL = 30 * 1000;

export const getDashboardsSummaryState = ({
  isLoading,
  error,
  data,
}: {
  isLoading: boolean;
  error: unknown;
  data?: unknown[] | null;
}) => ({
  loading: isLoading,
  count: error ? 0 : (data?.length ?? 0),
  error: error instanceof Error ? error.message : error ? String(error) : undefined,
});

const DashboardsSummaryCard: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const { isLoading, error, data } = useQuery({
    queryKey: ['dashboards'],
    queryFn: fetchPersesDashboardsMetadata,
    refetchInterval: REFRESH_INTERVAL,
  });

  const {
    loading,
    count,
    error: errorMessage,
  } = getDashboardsSummaryState({
    isLoading,
    error,
    data,
  });

  return (
    <SummaryCard
      cardId="dashboards"
      count={count}
      title={t('Perses Dashboards')}
      url={getDashboardsListUrl(perspective)}
      loading={loading}
      error={errorMessage}
    />
  );
};

export default DashboardsSummaryCard;
