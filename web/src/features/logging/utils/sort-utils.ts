type SortableValue = string | number;

// sort with an appropriate numeric comparator for big floats
export const numericComparator = <T extends SortableValue>(
  a: T,
  b: T,
  directionMultiplier: number,
  fallbackComparison?: number,
): number => {
  const result = a < b ? -1 : a > b ? 1 : 0;
  if (result === 0 && fallbackComparison !== undefined) {
    return fallbackComparison * directionMultiplier;
  }
  return result * directionMultiplier;
};

const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export const bigIntDifference = (a: bigint | undefined, b: bigint | undefined): number => {
  if (a === undefined || b === undefined) {
    return 0;
  }
  const difference = a - b;
  if (difference < MIN_SAFE_BIGINT) return Number.MIN_SAFE_INTEGER;
  if (difference > MAX_SAFE_BIGINT) return Number.MAX_SAFE_INTEGER;
  return Number(difference);
};
