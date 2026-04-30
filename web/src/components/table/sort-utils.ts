export const localeCompareSort = (
  a: string | undefined | null,
  b: string | undefined | null,
  direction: 'asc' | 'desc',
): number =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' }) *
    (direction === 'asc' ? 1 : -1) || 0;

export const directedSort = (comparatorResult: number, direction: 'asc' | 'desc'): number =>
  comparatorResult * (direction === 'asc' ? 1 : -1) || 0;
