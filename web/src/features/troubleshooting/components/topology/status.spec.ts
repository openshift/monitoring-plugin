jest.mock('@patternfly/react-topology', () => ({
  NodeStatus: {
    default: 'default',
    info: 'info',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  },
}));

import {
  mergeStatusCounts,
  Status,
  statusForNode,
  statusName,
  toStatus,
} from '../components/topology/status';
import * as api from '../korrel8r/client';
import * as korrel8r from '../korrel8r/types';

describe('Status enum', () => {
  it('has ordered severity levels', () => {
    expect(Status.info).toBeLessThan(Status.warning);
    expect(Status.warning).toBeLessThan(Status.danger);
  });
});

describe('statusName', () => {
  it.each([
    { status: Status.info, name: 'info' },
    { status: Status.warning, name: 'warning' },
    { status: Status.danger, name: 'danger' },
  ])('converts $name', ({ status, name }) => {
    expect(statusName(status)).toEqual(name);
  });
});

describe('statusForNode', () => {
  it.each([
    { status: Status.info, nodeStatus: 'info' },
    { status: Status.warning, nodeStatus: 'warning' },
    { status: Status.danger, nodeStatus: 'danger' },
  ])('converts $status to NodeStatus', ({ status, nodeStatus }) => {
    expect(statusForNode(status)).toEqual(nodeStatus);
  });
});

describe('toStatus', () => {
  it.each([
    { input: 'error', expected: Status.danger },
    { input: 'Error', expected: Status.danger },
    { input: 'ERROR', expected: Status.danger },
    { input: 'critical', expected: Status.danger },
    { input: 'Fatal', expected: Status.danger },
    { input: 'some error here', expected: Status.danger },
    { input: 'critically fatal', expected: Status.danger },
    { input: 'warn', expected: Status.warning },
    { input: 'warning', expected: Status.warning },
    { input: 'Warning', expected: Status.warning },
    { input: 'WARNING', expected: Status.warning },
    { input: 'info', expected: Status.info },
    { input: 'anything', expected: Status.info },
  ])('converts "$input" to $expected', ({ input, expected }) => {
    expect(toStatus(input)).toEqual(expected);
  });

  it('returns undefined for empty string', () => {
    expect(toStatus('')).toBeUndefined();
  });
});

const makeNode = (
  queries: Array<{ query: string; statuses: Array<{ status: string; count: number }> }>,
): korrel8r.Node => {
  const apiNode: api.Node = {
    class: 'log:application',
    count: 0,
    queries: queries.map((q) => ({
      query: q.query,
      count: q.statuses.reduce((sum, s) => sum + s.count, 0),
      statuses: q.statuses,
    })),
  };
  return new korrel8r.Node(apiNode);
};

describe('mergeStatusCounts', () => {
  it('returns empty counts and undefined status for a node with no statuses', () => {
    const node = makeNode([{ query: 'log:application:{}', statuses: [] }]);
    const [counts, status] = mergeStatusCounts(node);
    expect(counts).toEqual([]);
    expect(status).toBeUndefined();
  });

  it('returns the most severe status', () => {
    const node = makeNode([
      {
        query: 'log:application:{}',
        statuses: [
          { status: 'info', count: 1 },
          { status: 'error', count: 2 },
          { status: 'warning', count: 3 },
        ],
      },
    ]);
    const [, status] = mergeStatusCounts(node);
    expect(status).toEqual(Status.danger);
  });

  it('merges counts for the same status across queries', () => {
    const node = makeNode([
      { query: 'log:application:{}', statuses: [{ status: 'error', count: 5 }] },
      { query: 'log:infrastructure:{}', statuses: [{ status: 'error', count: 3 }] },
    ]);
    const [counts] = mergeStatusCounts(node);
    const errorCount = counts.find((c) => c.status === 'error');
    expect(errorCount?.count).toEqual(8);
  });

  it('handles a single status', () => {
    const node = makeNode([
      {
        query: 'log:application:{}',
        statuses: [{ status: 'warning', count: 10 }],
      },
    ]);
    const [counts, status] = mergeStatusCounts(node);
    expect(status).toEqual(Status.warning);
    expect(counts).toEqual([{ status: 'warning', count: 10 }]);
  });

  it('skips entries with empty status', () => {
    const node = makeNode([
      {
        query: 'log:application:{}',
        statuses: [
          { status: '', count: 5 },
          { status: 'info', count: 2 },
        ],
      },
    ]);
    const [counts, status] = mergeStatusCounts(node);
    expect(status).toEqual(Status.info);
    expect(counts).toHaveLength(1);
    expect(counts[0].status).toEqual('info');
  });
});
