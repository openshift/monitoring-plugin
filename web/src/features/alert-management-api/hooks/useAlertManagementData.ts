import { AlertStates, Rule, RuleStates } from '@openshift-console/dynamic-plugin-sdk';
import { useMemo } from 'react';

import {
  getMockRulesResponse,
  getMockSilencedAlertsResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { AlertManagementData } from '@/features/alert-management-api/types/types';
import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';
import { applyAlertsToRules } from '@/features/alert-management-api/utils/apply-alerts-to-rules';
import {
  GetAlertsResponse,
  GetRulesResponse,
  useGetAlerts,
  useGetRules,
} from '@/shared/clients/alert-management-api/generated/api';
import { getAlertsAndRules } from '@/shared/utils/alerts/formatting';

const ALERT_RULE_ID_LABEL = 'openshift_io_alert_rule_id';
const ALERT_SOURCE_LABEL = 'openshift_io_alert_source';

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
  const silencedAlertsQuery = useGetAlerts({
    params: { state: 'silenced' },
    options: {
      query: {
        ...(useMockResponses
          ? { queryFn: () => Promise.resolve(getMockSilencedAlertsResponse()) }
          : {}),
        refetchInterval: refreshIntervalMs,
      },
    },
  });
  const data = useMemo(
    () => processAlertManagementData(rulesQuery.data, silencedAlertsQuery.data),
    [rulesQuery.data, silencedAlertsQuery.data],
  );

  return { data, rulesQuery, silencedAlertsQuery };
};

const getRules = (rulesResponse: GetRulesResponse) => {
  // type the states and add the alertname label to alerts
  const groups = structuredClone(rulesResponse.data.groups).map((group) => ({
    ...group,
    rules: group.rules
      .filter((rule) => rule.type === 'alerting')
      .map((rule) => ({
        ...rule,
        state: rule.state as RuleStates,
        alerts: rule.alerts.map((alert) => ({
          ...alert,
          state: alert.state as AlertStates,
          labels: { alertname: rule.name, ...alert.labels },
        })),
      })),
  }));
  const responseRules = getAlertsAndRules({ groups }).rules;
  const rules: Rule[] = responseRules.map((rule) => ({
    ...rule,
    id: rule.labels[ALERT_RULE_ID_LABEL] || rule.id,
    sourceId: rule.labels[ALERT_SOURCE_LABEL] || rule.sourceId,
  }));
  return rules;
};

export const processAlertManagementData = (
  rulesResponse: GetRulesResponse | undefined,
  alertsResponse: GetAlertsResponse | undefined,
): AlertManagementData | undefined => {
  if (!rulesResponse) {
    return undefined;
  }

  const rules = applyAlertsToRules(getRules(rulesResponse), alertsResponse?.data.alerts ?? []);
  return {
    rules,
    alerts: rules.flatMap((rule) => rule.alerts.map((alert) => toManagedAlert({ ...alert, rule }))),
  };
};
