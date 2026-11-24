import type { ReactNode } from 'react';
import { useQueryParam } from 'use-query-params';

import { AlertManagementHeader } from '@/features/alert-management-api/components/layout/AlertManagementHeader';
import { RefreshControlProps } from '@/features/alert-management-api/components/layout/RefreshControl';
import { useAlertManagementData } from '@/features/alert-management-api/hooks/useAlertManagementData';
import { QueryParams } from '@/shared/constants/query-params';
import { RefreshIntervalParam } from '@/shared/constants/timespan';

type LayoutProps = {
  children: ReactNode;
};

export function AlertManagementLayout({ children }: LayoutProps) {
  const [intervalMs, onIntervalChange] = useQueryParam(
    QueryParams.RefreshInterval,
    RefreshIntervalParam,
  );
  const { rulesQuery, alertsQuery, silencesQuery } = useAlertManagementData(intervalMs);
  const lastRefreshedAt = Math.max(
    rulesQuery.dataUpdatedAt,
    alertsQuery.dataUpdatedAt,
    silencesQuery.dataUpdatedAt,
  );
  const refresh: RefreshControlProps = { intervalMs, onIntervalChange, lastRefreshedAt };

  return <AlertManagementHeader refresh={refresh}>{children}</AlertManagementHeader>;
}
