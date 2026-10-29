import { Direction, LogTableData } from '@/features/logging/utils/logs-types';

export interface TimestampBounds {
  oldest?: string;
  newest?: string;
}

/**
 * Computes the chronological anchors (oldest and newest raw timestamps) for a
 * set of table rows ragardless of the sorting.
 */
export const getTimestampBounds = (
  data: Array<Pick<LogTableData, 'rawTimestamp'>>,
): TimestampBounds => {
  let oldest: string | undefined;
  let newest: string | undefined;

  for (const { rawTimestamp } of data) {
    const timestamp = BigInt(rawTimestamp);

    if (oldest === undefined || timestamp < BigInt(oldest)) {
      oldest = rawTimestamp;
    }

    if (newest === undefined || timestamp > BigInt(newest)) {
      newest = rawTimestamp;
    }
  }

  return { oldest, newest };
};

export const getLoadMoreTimestamp = (
  bounds: TimestampBounds,
  direction?: Direction,
): string | undefined => (direction === 'forward' ? bounds.newest : bounds.oldest);
