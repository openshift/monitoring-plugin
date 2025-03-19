import { getLastLanguage } from './getLastLanguage';

const lang = getLastLanguage() || undefined;

// https://tc39.es/ecma402/#datetimeformat-objects
export const timeFormatter = new Intl.DateTimeFormat(lang, {
  hour: 'numeric',
  minute: 'numeric',
});

export const timeFormatterWithSeconds = new Intl.DateTimeFormat(lang, {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

export const dateFormatter = new Intl.DateTimeFormat(lang, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const dateFormatterNoYear = new Intl.DateTimeFormat(lang, {
  month: 'short',
  day: 'numeric',
});

export const dateTimeFormatter = (langArg?: string) =>
  new Intl.DateTimeFormat(langArg ?? lang, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    year: 'numeric',
  });

export const dateTimeFormatterWithSeconds = new Intl.DateTimeFormat(lang, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  year: 'numeric',
});
