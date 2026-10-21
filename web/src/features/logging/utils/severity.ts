export type Severity =
  | 'critical'
  | 'error'
  | 'warning'
  | 'info'
  | 'debug'
  | 'trace'
  | 'unknown'
  | 'other';

export const severityAbbreviations: Record<Severity, Array<string>> = {
  critical: ['critical', 'emerg', 'fatal', 'alert', 'crit'],
  error: ['error', 'err', 'eror'],
  debug: ['debug', 'dbug'],
  info: ['info', 'inf', 'information', 'notice'],
  trace: ['trace'],
  warning: ['warn', 'warning'],
  unknown: ['unknown'],
  other: [''],
};

export const severityFromString = (
  severityText: string | undefined | null,
): Severity | undefined => {
  for (const [group, abbreviations] of Object.entries(severityAbbreviations)) {
    if (severityText && abbreviations.includes(severityText)) {
      return group as Severity;
    }
  }

  return undefined;
};

export const isSeverity = (value: string): value is Severity =>
  Object.keys(severityAbbreviations).includes(value);

export const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case 'critical': // orange
      return 'var(--pf-t--chart--global--warning--color--100)';
    case 'error': // red
      return 'var(--pf-t--chart--global--danger--color--100)';
    case 'warning': // yellow
      return 'var(--pf-t--chart--global--warning--color--200)';
    case 'info':
      return 'var(--pf-t--chart--color--purple--300)';
    case 'debug':
      return 'var(--pf-t--chart--color--blue--300)';
    case 'trace':
      return 'var(--pf-t--chart--color--teal--300)';
    default: // gray
      return 'var(--pf-t--chart--color--black--300)';
  }
};

export const severityFiltersFromParams = (params: string | null): Set<Severity> => {
  const severityFilters: Array<Severity> =
    params
      ?.split(',')
      .map((s) => s.trim())
      .filter(isSeverity) ?? [];

  return severityFilters.length > 0 ? new Set(severityFilters) : new Set();
};
