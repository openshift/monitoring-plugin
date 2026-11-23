import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { useMemo } from 'react';

import { useSilencesQuery } from '@/features/alert-management-api/hooks/useSilencesQuery';
import {
  getMockAlertsResponse,
  getMockManagementRulesResponse,
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
  const rulesQuery = useGetRules(undefined, {
    query: {
      ...(useMockResponses
        ? { queryFn: () => Promise.resolve(getMockManagementRulesResponse()) }
        : {}),
      refetchInterval: refreshIntervalMs,
    },
  });
  const alertsQuery = useGetAlerts(undefined, {
    query: {
      ...(useMockResponses ? { queryFn: () => Promise.resolve(getMockAlertsResponse()) } : {}),
      refetchInterval: refreshIntervalMs,
    },
  });
  const silencesQuery = useSilencesQuery(refreshIntervalMs);

  const data = useMemo(
    () => processAlertManagementData(rulesQuery.data, alertsQuery.data, silencesQuery.data),
    [rulesQuery.data, alertsQuery.data, silencesQuery.data],
  );

  return { data, rulesQuery, alertsQuery, silencesQuery };
};

export const processAlertManagementData = (
  rulesResponse: GetRulesResponse | undefined,
  alertsResponse: GetAlertsResponse | undefined,
  silencesResponse: Silence[] | undefined,
): AlertManagementData | undefined => {
  if (!rulesResponse || !alertsResponse || !silencesResponse) {
    return undefined;
  }

  const rules = combineAlertsAndRules(rulesResponse, alertsResponse);

  const alerts = rules.flatMap((rule) => rule.alerts.map((alert) => ({ ...alert, rule })));

  const silences = silencesResponse.map((silence) => ({
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
