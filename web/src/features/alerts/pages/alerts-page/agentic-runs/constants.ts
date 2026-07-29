// FNV-1a 64-bit hash constants (Prometheus alerts fingerprint algorithm)
export const SEPARATOR_BYTE = 0xff;
export const FNV_OFFSET_BASIS = 14695981039346656037n;
export const FNV_PRIME = 1099511628211n;
export const UINT64_MASK = (1n << 64n) - 1n;
export const FINGERPRINT_PREFIX_LEN = 8;

// Proposal CR label keys
export const AGENTIC_RUN_LABEL_FINGERPRINT = 'agentic.openshift.io/alert-fingerprint';
export const AGENTIC_RUN_LABEL_SOURCE = 'agentic.openshift.io/source';

// Proposal CR values
export const AGENTIC_RUN_SOURCE_ALERTMANAGER = 'alertmanager';
export const AGENTIC_RUN_NAMESPACE = 'openshift-lightspeed';
export const AGENTIC_RUN_STALE_TIME = 30 * 1000;
