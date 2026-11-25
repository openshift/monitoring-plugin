import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSilencesQuery } from '@/features/alert-management-api/hooks/useSilencesQuery';
import {
  getMockAlertsResponse,
  getMockRulesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { AlertManagementData } from '@/features/alert-management-api/types/types';
import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';
import { combineAlertsAndRules } from '@/features/alert-management-api/utils/combine-management-data';
import {
  GetAlertsResponse,
  GetRulesResponse,
  useGetAlerts,
  useGetRules,
} from '@/shared/clients/alert-management-api/generated/api';
import { applySilences } from '@/shared/utils/alerts/apply-silences';
import { getSilenceName } from '@/shared/utils/alerts/formatting';

const useMockResponses = process.env.NODE_ENV === 'development';

export const useAlertManagementData = (refreshIntervalMs: number | false = false) => {
  const rulesQuery = useGetRules({
    options: {
      query: {
        ...(useMockResponses ? { queryFn: () => Promise.resolve(getMockRulesResponse()) } : {}),
        refetchInterval: refreshIntervalMs,
      },
    },
  });
  const alertsQuery = useGetAlerts({
    options: {
      query: {
        ...(useMockResponses ? { queryFn: () => Promise.resolve(getMockAlertsResponse()) } : {}),
        refetchInterval: refreshIntervalMs,
      },
    },
  });
  const silencesQuery = useSilencesQuery(refreshIntervalMs);

  const data = useMemo(
    () =>
      processAlertManagementData(rulesQuery.data, alertsQuery.data, {
        data: silencesQuery.data,
        isLoading: silencesQuery.isLoading,
      }),
    [rulesQuery.data, alertsQuery.data, silencesQuery.data, silencesQuery.isLoading],
  );

  return { data, rulesQuery, alertsQuery, silencesQuery };
};

export const processAlertManagementData = (
  rulesResponse: GetRulesResponse | undefined,
  alertsResponse: GetAlertsResponse | undefined,
  silencesQuery: Pick<UseQueryResult<Silence[], Error>, 'data' | 'isLoading'>,
): AlertManagementData | undefined => {
  if (!rulesResponse || !alertsResponse || silencesQuery.isLoading) {
    return undefined;
  }

  const rules = combineAlertsAndRules(rulesResponse, alertsResponse);

  const alerts = rules.flatMap((rule) => rule.alerts.map((alert) => ({ ...alert, rule })));

  const silences = (silencesQuery.data ?? []).map((silence) => ({
    ...silence,
    name: getSilenceName(silence),
  }));

  // Add alerts to silences and vice versa
  const derived = applySilences({
    alerts,
    rules,
    silences,
  });

  return {
    rules: derived.rules,
    alerts: derived.alerts.map(toManagedAlert),
    silences: derived.silences,
  };
};
