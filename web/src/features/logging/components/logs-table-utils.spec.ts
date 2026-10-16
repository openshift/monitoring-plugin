import {
  getLoadMoreTimestamp,
  getTimestampBounds,
} from '@/features/logging/components/logs-table-utils';
import { LogTableData } from '@/features/logging/logs-types';
import { getPaginationRange } from '@/features/logging/value-utils';

const messageSortedData = [
  { rawTimestamp: '300' },
  { rawTimestamp: '100' },
  { rawTimestamp: '200' },
] as Array<LogTableData>;

describe('load-more boundary selection (table -> hook)', () => {
  it('anchors are the chronological oldest/newest, independent of row (Message) order', () => {
    const bounds = getTimestampBounds(messageSortedData);

    expect(bounds).toEqual({ oldest: '100', newest: '300' });
  });

  it('paginates from the oldest visible timestamp when loading backward, even with Message sorting', () => {
    const bounds = getTimestampBounds(messageSortedData);
    const lastTimestampNs = getLoadMoreTimestamp(bounds, 'backward');

    // Oldest visible entry, not the final row of the message-sorted table.
    expect(lastTimestampNs).toBe('100');

    const { endNs } = getPaginationRange(lastTimestampNs as string, 'backward');
    expect(endNs).toBe(String(100n - 1n));
  });

  it('paginates from the newest visible timestamp when loading forward, even with Message sorting', () => {
    const bounds = getTimestampBounds(messageSortedData);
    const lastTimestampNs = getLoadMoreTimestamp(bounds, 'forward');

    // Newest visible entry, not the final row of the message-sorted table.
    expect(lastTimestampNs).toBe('300');

    const { startNs } = getPaginationRange(lastTimestampNs as string, 'forward');
    expect(startNs).toBe(String(300n + 1n));
  });

  it('returns no anchor when there is no data to paginate from', () => {
    const bounds = getTimestampBounds([]);

    expect(bounds).toEqual({ oldest: undefined, newest: undefined });
    expect(getLoadMoreTimestamp(bounds, 'backward')).toBeUndefined();
  });
});
