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
