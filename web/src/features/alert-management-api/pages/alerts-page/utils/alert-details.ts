import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

export const alertRuleIDParam = 'alertRuleID';
export const alertIDParam = 'alertID';

export function getAlertDetailsSearch(search: string, alert: ManagedAlert) {
  const params = new URLSearchParams(search);
  params.set(alertRuleIDParam, alert.rule.id);
  params.set(alertIDParam, computeAlertFingerprint(alert.labels));
  return `?${params}`;
}
