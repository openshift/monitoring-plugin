import { NodeStatus } from '@patternfly/react-topology';
import * as korrel8r from '../../korrel8r/types';

// Subset of status levels used by korrel8r, patternfly naming - "danger" for "error" .
export enum Status {
  info = 1,
  warning = 2,
  danger = 3,
}

// Type for status string values.
type StatusName = keyof typeof Status;

// Convert Status enum to enum name string.
export const statusName = (s: Status): StatusName => {
  return Status[s] as StatusName;
};

// Convert Status enum to NodeStatus
export const statusForNode = (s: Status | undefined): NodeStatus | undefined => {
  if (s === undefined) return undefined;
  const name = statusName(s);
  return name ? NodeStatus[name] : undefined;
};

// Convert a korrel8r status string to a status enum value
export const toStatus = (ks: string): Status | undefined => {
  if (ks.match(/error|critical|fatal/i)) return Status.danger;
  if (ks.match(/warn(ing)?/i)) return Status.warning;
  if (ks) return Status.info;
  return undefined;
};

// Collect and merge all status counts for the node.
// Return merges status counts and the most severe status seen.
export const mergeStatusCounts = (
  node: korrel8r.Node,
): [korrel8r.StatusCount[], Status | undefined] => {
  const m = new Map<string, number>(); // Original status string, total count.
  let s = 0;
  node.queries.forEach((qc) =>
    (qc.statuses ?? []).forEach((sc) => {
      if (!sc.status) return;
      m.set(sc.status, (m.get(sc.status) ?? 0) + (sc.count ?? 0));
      s = Math.max(s, toStatus(sc.status) ?? 0);
    }),
  );
  const sc = [...m.entries()].map(([status, count]) => ({ status, count }));
  return [sc, s || undefined];
};
