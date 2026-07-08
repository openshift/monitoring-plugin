// FNV-1a 64-bit hash constants (Prometheus alerts fingerprint algorithm)
export const SEPARATOR_BYTE = 0xff;
export const FNV_OFFSET_BASIS = 14695981039346656037n;
export const FNV_PRIME = 1099511628211n;
export const UINT64_MASK = (1n << 64n) - 1n;
export const FINGERPRINT_PREFIX_LEN = 8;

// Proposal CR label keys
export const PROPOSAL_LABEL_FINGERPRINT = 'agentic.openshift.io/alert-fingerprint';
export const PROPOSAL_LABEL_SOURCE = 'agentic.openshift.io/source';
export const PROPOSAL_LABEL_ALERT_NAME = 'agentic.openshift.io/alert-name';
export const PROPOSAL_LABEL_ALERT_SEVERITY = 'agentic.openshift.io/alert-severity';

// Proposal CR values
export const PROPOSAL_SOURCE_ALERTMANAGER = 'alertmanager';
export const PROPOSAL_NAMESPACE = 'openshift-lightspeed';
export const PROPOSAL_STALE_TIME = 30 * 1000;
