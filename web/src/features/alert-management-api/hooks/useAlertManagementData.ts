import {
  Alert,
  consoleFetchJSON,
  PrometheusRulesResponse,
  Rule,
  Silence,
} from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  getMockRulesResponse,
  getMockSilencesResponse,
} from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { AlertManagementData } from '@/features/alert-management-api/types/types';
import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { fetchAlerts } from '@/shared/store/fetch-alerts';
import { applySilences } from '@/shared/utils/alerts/apply-silences';
import { getAlertsAndRules, getSilenceName } from '@/shared/utils/alerts/formatting';
import { getAlertmanagerSilencesUrl, getPrometheusBasePath } from '@/shared/utils/utils';

const ALERT_RULE_ID_LABEL = 'openshift_io_alert_rule_id';
const ALERT_SOURCE_LABEL = 'openshift_io_alert_source';

const useMockResponses = process.env.NODE_ENV === 'development';

export const useAlertManagementData = (refreshInterval: number | false = false) => {
  const { prometheus } = useMonitoring();
  const rulesUrl = getPrometheusBasePath({ prometheus: 'alert-management-api' }) + '/rules';
  const silencesUrl = getAlertmanagerSilencesUrl({
    prometheus,
    useTenancyPath: false,
  });
  const rulesQuery = useQuery<PrometheusRulesResponse, Error>({
    queryKey: ['alert-management-api', 'rules'],
    queryFn: () =>
      useMockResponses ? Promise.resolve(getMockRulesResponse()) : fetchAlerts(rulesUrl),
    refetchInterval: refreshInterval,
  });
  const silencesQuery = useQuery<Silence[], Error>({
    queryKey: ['alert-management-api', prometheus, 'silences'],
    queryFn: () =>
      useMockResponses
        ? Promise.resolve(getMockSilencesResponse())
        : (consoleFetchJSON(silencesUrl, 'GET') as Promise<Silence[]>),
    refetchInterval: refreshInterval,
  });
  const data = useMemo(
    () => processAlertManagementData(rulesQuery.data, silencesQuery.data),
    [rulesQuery.data, silencesQuery.data],
  );

  return { data, rulesQuery, silencesQuery };
};

const getRulesAndAlerts = (rulesResponse: PrometheusRulesResponse) => {
  const responseRules = getAlertsAndRules(structuredClone(rulesResponse.data)).rules;
  const rules: Rule[] = responseRules.map((rule) => ({
    ...rule,
    id: rule.labels[ALERT_RULE_ID_LABEL] || rule.id,
    sourceId: rule.labels[ALERT_SOURCE_LABEL] || rule.sourceId,
  }));
  const alerts: Alert[] = rules.flatMap((rule) =>
    rule.alerts.map((alert) => ({ ...alert, rule }) as Alert),
  );

  return { alerts, rules };
};

export const processAlertManagementData = (
  rulesResponse: PrometheusRulesResponse | undefined,
  silencesResponse: Silence[] | undefined,
): AlertManagementData | undefined => {
  if (!rulesResponse) return undefined;

  const { alerts, rules } = getRulesAndAlerts(rulesResponse);
  const silences = (silencesResponse ?? []).map((silence) => ({
    ...silence,
    name: getSilenceName(silence),
  }));
  const derived = applySilences({ alerts, rules, silences });
  return { alerts: derived.alerts.map(toManagedAlert), silences: derived.silences };
};
