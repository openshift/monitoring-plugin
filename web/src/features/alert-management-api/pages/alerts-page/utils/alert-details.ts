import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { QueryParams } from '@/shared/constants/query-params';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

export function getAlertDetailsSearch(search: string, alert: ManagedAlert) {
  const params = new URLSearchParams(search);
  params.set(QueryParams.AlertRuleID, alert.rule.id);
  params.set(QueryParams.AlertID, computeAlertFingerprint(alert.labels));
  return `?${params}`;
}
