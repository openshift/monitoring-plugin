const AllGraphUnits = [
  'Bytes',
  'bytes',
  'bps',
  'Bps',
  'pps',
  'ms',
  's',
  'percentunit',
  'short',
] as const;
export type GraphUnits = (typeof AllGraphUnits)[number];

export function isGraphUnit(value: string): value is GraphUnits {
  return AllGraphUnits.includes(value as GraphUnits);
}
