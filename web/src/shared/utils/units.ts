const ALL_GRAPH_UNITS = [
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
export type GraphUnits = (typeof ALL_GRAPH_UNITS)[number];

export function isGraphUnit(value: string): value is GraphUnits {
  return ALL_GRAPH_UNITS.includes(value as GraphUnits);
}
