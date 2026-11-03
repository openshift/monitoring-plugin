import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import {
  AGENTIC_RUN_LABEL_FINGERPRINT,
  FINGERPRINT_PREFIX_LEN,
} from '@/shared/hooks/agentic-runs/constants';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

export const getAlertFingerprintPrefix = (labels: Record<string, string>): string =>
  computeAlertFingerprint(labels).slice(0, FINGERPRINT_PREFIX_LEN);

export const matchesAgenticRun = (alert: Alert, proposal: K8sResourceCommon): boolean => {
  const proposalFp = proposal.metadata?.labels?.[AGENTIC_RUN_LABEL_FINGERPRINT];
  if (!proposalFp) {
    return false;
  }
  return proposalFp === getAlertFingerprintPrefix(alert.labels);
};
