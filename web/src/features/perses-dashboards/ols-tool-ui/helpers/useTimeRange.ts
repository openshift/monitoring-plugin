import { useMemo } from 'react';
import { sub } from 'date-fns';
import type { AbsoluteTimeRange, RelativeTimeRange, TimeRangeValue } from '@perses-dev/core';
import { isDurationString, parseDurationString } from '@perses-dev/core';

// Parse a Prometheus-style time expression like "NOW", "NOW-48h", "NOW-1d2h30m",
// or a plain date string like "2024-01-01T00:00:00Z".
const parseTimeExpr = (expr: string, now: Date): Date | undefined => {
  const match = expr.match(/^NOW(?:-(.+))?$/);
  if (!match) {
    const parsed = new Date(expr);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (!match[1]) {
    return now;
  }
  if (isDurationString(match[1])) {
    return sub(now, parseDurationString(match[1]));
  }
  return undefined;
};

export const useTimeRange = (start?: string, end?: string, duration?: string): TimeRangeValue => {
  return useMemo(() => {
    const now = new Date();
    const safeDuration = duration && isDurationString(duration) ? duration : '1h';
    const startDate = start ? parseTimeExpr(start, now) : undefined;
    const endDate = end ? parseTimeExpr(end, now) : undefined;

    // If end is exactly "NOW" with no offset and no explicit start, use relative time range
    if (end === 'NOW' && !start) {
      return { pastDuration: safeDuration } as RelativeTimeRange;
    }

    if (startDate && endDate) {
      return { start: startDate, end: endDate } as AbsoluteTimeRange;
    }
    return { pastDuration: safeDuration } as RelativeTimeRange;
  }, [duration, end, start]);
};
