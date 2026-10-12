import {
  defaultTimeRange,
  intervalFromTimeRange,
  numericTimeRange,
  spanFromTimeRange,
} from '@/features/logging/time-range';

const mockNow = new Date('2022-10-17T10:37:40+0000').getTime();

describe('Time Range', () => {
  it('should create a valid numeric time range from a time range', () => {
    [
      {
        timeRange: { start: 'now-1h', end: '1h' },
        expected: { start: 1665999460000, end: 1666003060000 },
      },
      {
        timeRange: { start: 1665999460000, end: 1666003060000 },
        expected: { start: 1665999460000, end: 1666003060000 },
      },
      {
        timeRange: { start: '1665999460000', end: '1666003060000' },
        expected: { start: 1665999460000, end: 1666003060000 },
      },
      {
        timeRange: { start: 'invalid start', end: '1666003060000' },
        expected: defaultTimeRange(mockNow),
      },
      {
        timeRange: { start: '1665999460000', end: 'invalid end' },
        expected: defaultTimeRange(mockNow),
      },
    ].forEach(({ timeRange, expected }) => {
      expect(numericTimeRange(timeRange, mockNow)).toEqual(expected);
    });
  });

  it('should create a valid interval from a time range', () => {
    [
      {
        timeRange: { start: 'now-2h', end: 'now' },
        expected: 2 * 60 * 1000, // Every 2 minutes
      },
      {
        timeRange: { start: 'now-1d', end: 'now' },
        expected: 24 * 60 * 1000, // Every 24 minutes
      },
      {
        timeRange: { start: '1665999460000', end: '1666003060000' },
        expected: 60 * 1000, // Every minute
      },
    ].forEach(({ timeRange, expected }) => {
      expect(intervalFromTimeRange(timeRange, mockNow)).toEqual(expected);
    });
  });

  it('should create a valid span from a time range', () => {
    [
      {
        timeRange: { start: 'now-2h', end: 'now' },
        expected: 2 * 60 * 60 * 1000,
      },
      {
        timeRange: { start: 1665999460000, end: 1666003060000 },
        expected: 1666003060000 - 1665999460000,
      },
      {
        timeRange: { start: '1665999460000', end: '1666003060000' },
        expected: 1666003060000 - 1665999460000,
      },
    ].forEach(({ timeRange, expected }) => {
      expect(spanFromTimeRange(timeRange, mockNow)).toEqual(expected);
    });
  });
});
