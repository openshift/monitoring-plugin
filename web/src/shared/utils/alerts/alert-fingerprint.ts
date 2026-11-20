const SEPARATOR_BYTE = 0xff;
const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const UINT64_MASK = (1n << 64n) - 1n;

// Alert Management API metadata can differ between endpoints, so standardize by removing
const metadataLabels = new Set([
  'openshift_io_alert_backend',
  'openshift_io_alert_rule_id',
  'openshift_io_alert_source',
  'openshift_io_prometheus_rule_namespace',
  'openshift_io_prometheus_rule_name',
  'openshift_io_alerting_rule_name',
  'openshift_io_rule_managed_by',
  'openshift_io_relabel_config_managed_by',
  'openshift_io_alert_rule_component',
  'openshift_io_alert_rule_layer',
  'openshift_io_alert_rule_component_from',
  'openshift_io_alert_rule_layer_from',
  'openshift_io_alert_rule_classification_managed_by',
]);

/**
 * Computes the Prometheus-compatible FNV-1a 64-bit fingerprint of a label set.
 * Replicates the algorithm from prometheus/common/model/signature.go:
 * - Sort label names lexicographically
 * - For each pair: hash(name + 0xFF + value + 0xFF)
 * - Returns 16-char zero-padded hex string
 *
 * Set ignoreMetadataLabels to normalize Management API metadata, including
 * source and rule ID. The default includes all labels for Prometheus compatibility.
 */
export const computeAlertFingerprint = (
  labels: Record<string, string>,
  ignoreMetadataLabels = false,
): string => {
  const names = Object.keys(labels)
    .filter((name) => !ignoreMetadataLabels || !metadataLabels.has(name))
    .sort();

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
