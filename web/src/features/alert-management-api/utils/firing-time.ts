import { parsePrometheusDuration } from '@/shared/console/console-shared/src/datetime/prometheus';

export const getFiringTimeRange = (value: string, now = Date.now()) => {
  if (value.startsWith('custom:')) {
    const dates = value.slice('custom:'.length).split(',');
    if (dates.length !== 2) return undefined;
    const from = Date.parse(dates[0]);
    const to = Date.parse(dates[1]);
    return Number.isFinite(from) && Number.isFinite(to) && from <= to ? { from, to } : undefined;
  }

  const duration = parsePrometheusDuration(value);
  return duration ? { from: now - duration, to: now } : undefined;
};
