import { TimeRangeNumber } from '@/features/logging/logs-types';
import { padLeadingZero } from '@/features/logging/value-utils';

export enum DateFormat {
  TimeShort,
  TimeMed,
  TimeFull,
  DateMed,
  Full,
}

export const normalizeTimezone = (timezone?: string): string | undefined =>
  timezone?.trim() || undefined;

const isDateValid = (date: Date | number): boolean =>
  date instanceof Date ? !isNaN(date.getTime()) : !isNaN(date);

const getFormattedParts = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timezone?: string,
): Record<string, string> => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: normalizeTimezone(timezone),
  });
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
};

const getTimePartsInTimezone = (date: Date, timezone?: string) => {
  const parts = getFormattedParts(
    date,
    { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
    timezone,
  );
  return {
    hours: parts.hour ?? '00',
    minutes: parts.minute ?? '00',
    seconds: parts.second ?? '00',
    milliseconds: padLeadingZero(date.getMilliseconds(), 3),
  };
};

const getDatePartsInTimezone = (date: Date, timezone?: string) => {
  const parts = getFormattedParts(
    date,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    timezone,
  );
  return {
    year: parts.year ?? '0000',
    month: parts.month ?? '00',
    day: parts.day ?? '00',
  };
};

export const dateToFormat = (
  date: Date | number,
  format: DateFormat,
  timezone?: string,
): string => {
  if (!isDateValid(date)) {
    return 'invalid date';
  }

  const dateObject = new Date(date);
  const { hours, minutes, seconds, milliseconds } = getTimePartsInTimezone(dateObject, timezone);

  switch (format) {
    case DateFormat.TimeShort:
      return `${hours}:${minutes}`;
    case DateFormat.TimeMed:
      return `${hours}:${minutes}:${seconds}`;
    case DateFormat.TimeFull:
      return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    case DateFormat.DateMed: {
      const { year, month, day } = getDatePartsInTimezone(dateObject, timezone);
      return `${year}-${month}-${day}`;
    }
    case DateFormat.Full: {
      const formatted = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        year: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZone: normalizeTimezone(timezone),
      }).format(dateObject);
      return `${formatted}.${milliseconds}`;
    }
  }
};

export const getTimeFormatFromTimeRange = (timeRange: TimeRangeNumber): DateFormat =>
  getTimeFormatFromInterval(timeRange.end - timeRange.start);

export const getTimeFormatFromInterval = (interval: number): DateFormat => {
  if (interval <= 60 * 1000) {
    return DateFormat.TimeFull;
  }
  if (interval < 30 * 60 * 1000) {
    return DateFormat.TimeMed;
  }
  return DateFormat.TimeShort;
};

export const getBrowserTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface TimezoneOffset {
  label: string;
  offsetMinutes: number;
}

/**
 * Parses an offset label like "GMT-05:00" or "GMT+05:30" to minutes.
 * Returns 0 for "GMT", "UTC", or unparseable strings.
 */
const parseOffsetLabel = (label: string): number => {
  const match = label.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || '0', 10);
  return sign * (hours * 60 + minutes);
};

/**
 * Gets the timezone offset for a given timezone at a specific date.
 * Positive offset = ahead of UTC (e.g., +330 for Asia/Kolkata),
 * negative = behind UTC (e.g., -300 for America/New_York).
 */
export const getTimezoneOffset = (timezone: string, date: Date = new Date()): TimezoneOffset => {
  const normalizedTz = normalizeTimezone(timezone);
  if (!normalizedTz) {
    return { label: '', offsetMinutes: 0 };
  }

  try {
    const parts = getFormattedParts(date, { timeZoneName: 'shortOffset' }, normalizedTz);
    const label = parts.timeZoneName ?? '';
    return { label, offsetMinutes: parseOffsetLabel(label) };
  } catch {
    return { label: '', offsetMinutes: 0 };
  }
};

/**
 * Parses a date and time string as if they are in the given timezone,
 * and returns the corresponding UTC timestamp in milliseconds.
 */
export const parseInTimezone = (dateStr: string, timeStr: string, timezone?: string): number => {
  const effectiveTimezone = normalizeTimezone(timezone) ?? getBrowserTimezone();
  const localParsed = Date.parse(`${dateStr}T${timeStr}`);

  if (isNaN(localParsed)) {
    return NaN;
  }

  const localDate = new Date(localParsed);
  const browserOffsetMinutes = -localDate.getTimezoneOffset();
  const targetOffsetMinutes = getTimezoneOffset(effectiveTimezone, localDate).offsetMinutes;

  // Convert from browser-interpreted local time to target timezone time
  return localParsed - (targetOffsetMinutes - browserOffsetMinutes) * 60 * 1000;
};
