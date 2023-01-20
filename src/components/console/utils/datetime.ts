import * as _ from 'lodash-es';

const LAST_LANGUAGE_LOCAL_STORAGE_KEY = 'bridge/last-language';
const getLastLanguage = (): string => localStorage.getItem(LAST_LANGUAGE_LOCAL_STORAGE_KEY);

// https://tc39.es/ecma402/#datetimeformat-objects
export const timeFormatter = new Intl.DateTimeFormat(getLastLanguage() || undefined, {
  hour: 'numeric',
  minute: 'numeric',
});

export const timeFormatterWithSeconds = new Intl.DateTimeFormat(getLastLanguage() || undefined, {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

export const dateFormatterNoYear = new Intl.DateTimeFormat(getLastLanguage() || undefined, {
  month: 'short',
  day: 'numeric',
});

export const dateTimeFormatterWithSeconds = new Intl.DateTimeFormat(
  getLastLanguage() || undefined,
  {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    year: 'numeric',
  },
);

// Conversions between units and milliseconds
const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const units = { w, d, h, m, s };

// Formats a duration in milliseconds like "1h 10m"
export const formatPrometheusDuration = (ms: number) => {
  if (!_.isFinite(ms) || ms < 0) {
    return '';
  }
  let remaining = ms;
  let str = '';
  _.each(units, (factor, unit) => {
    const n = Math.floor(remaining / factor);
    if (n > 0) {
      str += `${n}${unit} `;
      remaining -= n * factor;
    }
  });
  return _.trim(str);
};

// Converts a duration like "1h 10m 23s" to milliseconds or returns 0 if the duration could not be
// parsed
export const parsePrometheusDuration = (duration: string): number => {
  try {
    const parts = duration
      .trim()
      .split(/\s+/)
      .map((p) => p.match(/^(\d+)([wdhms])$/));
    return _.sumBy(parts, (p) => parseInt(p[1], 10) * units[p[2]]);
  } catch (ignored) {
    // Invalid duration format
    return 0;
  }
};

const zeroPad = (number: number) => (number < 10 ? `0${number}` : number);

// Get YYYY-MM-DD date string for a date object
export const toISODateString = (date: Date): string =>
  `${date.getFullYear()}-${zeroPad(date.getMonth() + 1)}-${zeroPad(date.getDate())}`;
