export const localeCompareSort = (
  a: string | undefined | null,
  b: string | undefined | null,
  direction: 'asc' | 'desc',
): number =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' }) *
    (direction === 'asc' ? 1 : -1) || 0;

// Parses a Prometheus metric value string to a JS number.
// +Inf → Infinity, -Inf → -Infinity, NaN → NaN, everything else via Number().
export const parsePrometheusValue = (v: unknown): number => {
  const s = String(v);
  if (s === '+Inf') return Infinity;
  if (s === '-Inf') return -Infinity;
  return Number(s);
};

const isNumeric = (s: string) => s !== '' && !Number.isNaN(parsePrometheusValue(s));

export const naturalSort = (
  a: string | undefined | null,
  b: string | undefined | null,
  direction: 'asc' | 'desc',
): number => {
  const aStr = a ?? '';
  const bStr = b ?? '';
  const dir = direction === 'asc' ? 1 : -1;
  const aIsNum = isNumeric(aStr);
  const bIsNum = isNumeric(bStr);
  // Mixed classes: numerics sort before non-numerics in a direction-independent order.
  if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;
  if (aIsNum) return (parsePrometheusValue(aStr) - parsePrometheusValue(bStr)) * dir || 0;
  return aStr.localeCompare(bStr, undefined, { sensitivity: 'base', numeric: true }) * dir || 0;
};

export const directedSort = (comparatorResult: number, direction: 'asc' | 'desc'): number =>
  comparatorResult * (direction === 'asc' ? 1 : -1) || 0;

// Returns a comparator for sorting rows by a Prometheus metric value column.
// NaN sorts last in both directions; +Inf/-Inf sort as larger/smaller than all finite values.
export const makeValueColumnSorter =
  (colIndex: number, direction: 'asc' | 'desc') =>
  (a: unknown[], b: unknown[]): number => {
    const aNum = parsePrometheusValue(a[colIndex]);
    const bNum = parsePrometheusValue(b[colIndex]);
    if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
    if (Number.isNaN(aNum)) return 1;
    if (Number.isNaN(bNum)) return -1;
    return (aNum - bNum) * (direction === 'asc' ? 1 : -1);
  };

// Returns a comparator for sorting rows by a label column using naturalSort.
export const makeLabelColumnSorter =
  (colIndex: number, direction: 'asc' | 'desc') =>
  (a: unknown[], b: unknown[]): number =>
    naturalSort(String(a[colIndex] ?? ''), String(b[colIndex] ?? ''), direction);
