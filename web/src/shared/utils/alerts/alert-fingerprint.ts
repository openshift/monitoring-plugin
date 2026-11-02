const SEPARATOR_BYTE = 0xff;
const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const UINT64_MASK = (1n << 64n) - 1n;

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
