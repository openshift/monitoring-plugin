/** Immutable time period. There are two types of time period:
 * - duration up to now, no explicit end time.
 * - start/end range with explicit start and end Date
 */
export interface Period {
  /** [start, end] of period */
  startEnd(): [Date, Date];
}

/** Duration is a count of some time unit (hours, days etc.) */
export class Duration implements Period {
  public readonly count: number;

  constructor(
    count: number,
    public readonly unit: Unit,
  ) {
    this.count = Math.abs(count);
  }

  // Create a duration from a milliseconds value using the largest unit that doesn't lose precision.
  static fromMilliseconds = (ms: number): Duration => {
    for (const unit of [...units].reverse()) {
      if (ms >= unit && ms % unit === 0) {
        return new Duration(ms / unit, unit);
      }
    }
    return new Duration(Math.round(ms / SECOND), SECOND);
  };

  // Duration from start till now.
  static since(start: Date): Duration | undefined {
    return start ? Duration.fromMilliseconds(Date.now() - start.getTime()) : undefined;
  }

  // Parse a duration string like "30s", "5m", "2h", "7d", "2w".
  static parse(str: string): Duration | undefined {
    if (!str) return undefined;
    const regex = /^\s*(\d+)\s*(s|m|h|d|w)\s*$/;
    const match = regex.exec(str);
    if (match !== null) {
      const value = parseInt(match[1], 10);
      const unit = UNIT_CHARS[match[2].toLowerCase()];
      return new Duration(value, unit);
    }
    return undefined;
  }

  static isDuration(period: Period): period is Duration {
    return period instanceof Duration;
  }

  toString(): string {
    return `${this.count}${unitChars(this.unit)}`;
  }

  duration(): number {
    return this.count * this.unit;
  }

  startEnd(): [Date, Date] {
    const end = new Date(Date.now());
    return [new Date(end.getTime() - this.duration()), end];
  }
}

/** Range is an explicit pair of start/end time points */
export class Range implements Period {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {
    if (this.end.getTime() < this.start.getTime()) {
      [this.start, this.end] = [this.end, this.start];
    }
  }
  startEnd(): [Date, Date] {
    return [this.start, this.end];
  }
}

// Parse a start/end pair of numeric timestamps (in units of scaleMs milliseconds) into a Range.
// If endParam is missing, the range ends "now". Returns undefined if startParam is missing or
// either value fails to parse.
export const parseRange = (
  startParam?: string,
  endParam?: string,
  scaleMs = 1,
): Range | undefined => {
  if (!startParam) return undefined;
  const start = new Date(Number(startParam) * scaleMs);
  const end = endParam ? new Date(Number(endParam) * scaleMs) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
  return new Range(start, end);
};

export const END_NOW_TOLERANCE_MS = 60000;

// Return a Duration if end is close to now, else return a Range.
export const periodFrom = (start: Date, end: Date): Period | undefined => {
  if (!start) return undefined;
  if (!end) return Duration.since(start);
  if (end.getTime() < start.getTime()) return undefined;
  const endsNow = Math.abs(Date.now() - end.getTime()) < END_NOW_TOLERANCE_MS;
  return endsNow ? Duration.fromMilliseconds(end.getTime() - start.getTime()) : new Range(start, end);
};

export enum Unit {
  SECOND = 1000,
  MINUTE = 60 * SECOND,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR,
  WEEK = 7 * DAY,
}

export const units: Unit[] = [Unit.SECOND, Unit.MINUTE, Unit.HOUR, Unit.DAY, Unit.WEEK];
export const [SECOND, MINUTE, HOUR, DAY, WEEK] = units;

// Single source of truth for Duration string <-> Unit conversion.
export const UNIT_CHARS: Record<string, Unit> = {
  s: Unit.SECOND,
  m: Unit.MINUTE,
  h: Unit.HOUR,
  d: Unit.DAY,
  w: Unit.WEEK,
};

export const unitChars = (unit: Unit): string =>
  Object.keys(UNIT_CHARS).find((char) => UNIT_CHARS[char] === unit) ?? 's';

/** Modify a Date by setting the time-of-day part only.
 *  @returns the modified date.
 */
export const setTime = (to: Date, hours = 0, minutes = 0, seconds = 0, milliseconds = 0): Date => {
  if (isValidDate(to)) {
    to.setHours(hours);
    to.setMinutes(minutes);
    to.setSeconds(seconds);
    to.setMilliseconds(milliseconds);
  }
  return to;
};

/**
 *  Modify a date by copying the time-of-day from another date.
 *  @returns the modified date.
 */
export const copyTime = (to: Date, from: Date): Date => {
  return setTime(to, from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
};

// Define our own isValidDate - don't import react modules in a plain .ts file.
export const isValidDate = (date?: Date) => Boolean(date && !isNaN(date.valueOf()));

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};
