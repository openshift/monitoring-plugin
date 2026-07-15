import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import {
  FINGERPRINT_PREFIX_LEN,
  FNV_OFFSET_BASIS,
  FNV_PRIME,
  AGENTIC_RUN_LABEL_FINGERPRINT,
  SEPARATOR_BYTE,
  UINT64_MASK,
} from './constants';

/**
 * Computes the Prometheus-compatible FNV-1a 64-bit fingerprint of a label set.
 * Replicates the algorithm from prometheus/common/model/signature.go:
 * - Sort label names lexicographically
 * - For each pair: hash(name + 0xFF + value + 0xFF)
 * - Returns 16-char zero-padded hex string
 */
export const computeAlertFingerprint = (labels: Record<string, string>): string => {
  const names = Object.keys(labels).sort();

  let hash = FNV_OFFSET_BASIS;
  for (const name of names) {
    const value = labels[name];
    const bytes = new TextEncoder().encode(name);
    for (const b of bytes) {
      hash ^= BigInt(b);
      hash = (hash * FNV_PRIME) & UINT64_MASK;
    }
    hash ^= BigInt(SEPARATOR_BYTE);
    hash = (hash * FNV_PRIME) & UINT64_MASK;

    const valueBytes = new TextEncoder().encode(value);
    for (const b of valueBytes) {
      hash ^= BigInt(b);
      hash = (hash * FNV_PRIME) & UINT64_MASK;
    }
    hash ^= BigInt(SEPARATOR_BYTE);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }

  return hash.toString(16).padStart(16, '0');
};

export const getAlertFingerprintPrefix = (labels: Record<string, string>): string =>
  computeAlertFingerprint(labels).slice(0, FINGERPRINT_PREFIX_LEN);

export const matchesAgenticRun = (alert: Alert, proposal: K8sResourceCommon): boolean => {
  const proposalFp = proposal.metadata?.labels?.[AGENTIC_RUN_LABEL_FINGERPRINT];
  if (!proposalFp) {
    return false;
  }
  return proposalFp === getAlertFingerprintPrefix(alert.labels);
};
