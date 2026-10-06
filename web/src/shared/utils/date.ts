export const padNumber = (value: number): string => String(value).padStart(2, '0');

export const formatSilenceDate = (date: Date): string => {
  const datePart = [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join('/');
  const timePart = [date.getHours(), date.getMinutes(), date.getSeconds()].map(padNumber).join(':');
  return `${datePart} ${timePart}`;
};

// Parse `YYYY-MM-DD` + 24-hour `HH:MM(:SS)` into a local-time epoch (ms).
// Built from numeric components to avoid `Date.parse` of a locale-formatted
// string, which is implementation-defined and can return NaN across browsers.
// Returns NaN for missing/non-numeric input so callers can guard with isFinite.
export const parseLocalDateTime = (dateString: string, timeString: string): number => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString ?? '') ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(timeString ?? '')
  ) {
    return NaN;
  }
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timeString.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  date.setFullYear(year);
  const isNormalized =
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds;
  return isNormalized ? NaN : date.getTime();
};
