import { getTimeRanges, QUERY_CHUNK_SIZE } from '@/shared/utils/utils';

const day = QUERY_CHUNK_SIZE;
const week = 7 * day;
const hour = day / 24;
const startTime = 1_700_000_000_000.25;

describe('getTimeRanges', () => {
  it.each([
    { timespan: week - hour, durations: [week - hour] },
    { timespan: week, durations: Array<number>(7).fill(day) },
    { timespan: week + hour, durations: [...Array<number>(7).fill(day), hour] },
    { timespan: week + 1, durations: [...Array<number>(6).fill(day), day + 1] },
  ])('covers exactly $timespan ms', ({ timespan, durations }) => {
    const endTime = startTime + timespan;
    const ranges = getTimeRanges(timespan, endTime);

    expect(ranges.map((range) => range.duration)).toEqual(durations);
    let nextStart = startTime;
    for (const range of ranges) {
      expect(range.endTime - range.duration).toBe(nextStart);
      nextStart = range.endTime;
    }
    expect(nextStart).toBe(endTime);
  });
});
