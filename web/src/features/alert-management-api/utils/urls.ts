import type { PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';

import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { QueryParams } from '@/shared/constants/query-params';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';
import { labelsToParams } from '@/shared/utils/utils';

// To be updated when rule detail page is implemented
export function getAlertRuleDetailsUrl(rule: Pick<Rule, 'id'>) {
  return `/monitoring/v2/management/alertrules${getAlertRuleDetailsSearch('', rule)}`;
}

export function getAlertRuleDetailsSearch(search: string, rule: Pick<Rule, 'id'>) {
  const params = new URLSearchParams(search);
  params.set(QueryParams.AlertRuleID, rule.id);
  params.delete(QueryParams.AlertID);
  return `?${params}`;
}

export const silencesPath = '/monitoring/v2/management/silences';

export const getSilencesPageUrl = (silenceID: string): string => {
  return `${silencesPath}?${new URLSearchParams({ silenceID })}`;
};

export const getCreateSilenceUrl = (labels?: PrometheusLabels): string => {
  const search = labels ? labelsToParams(labels) : '';
  return `${silencesPath}/~new${search ? `?${search}` : ''}`;
};

export function getAlertDetailsSearch(search: string, alert: ManagedAlert) {
  const params = new URLSearchParams(search);
  params.set(QueryParams.AlertRuleID, alert.rule.id);
  params.set(QueryParams.AlertID, computeAlertFingerprint(alert.labels));
  return `?${params}`;
}
