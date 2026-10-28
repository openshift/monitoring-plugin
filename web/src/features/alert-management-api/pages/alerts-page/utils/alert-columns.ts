export const optionalAlertColumns = [
  { key: 'total', label: 'Total' },
  { key: 'state', label: 'State' },
  { key: 'scope', label: 'Alert scope' },
  { key: 'component', label: 'Affected component' },
  { key: 'source', label: 'Source' },
  { key: 'description', label: 'Description (in alert)' },
  { key: 'firingSince', label: 'Firing since' },
  { key: 'runbookUrl', label: 'Runbook URL (in alert)' },
  { key: 'namespace', label: 'Namespace (in alert)' },
  { key: 'resource', label: 'Resource (in alert)' },
] as const;

export type OptionalAlertColumn = (typeof optionalAlertColumns)[number]['key'];

export const defaultVisibleAlertColumns: OptionalAlertColumn[] = [
  'total',
  'state',
  'scope',
  'component',
  'source',
];

export const alertColumns = [
  { key: 'name', label: 'Alert name' },
  { key: 'severity', label: 'Severity' },
  ...optionalAlertColumns,
] as const;

export type AlertColumn = (typeof alertColumns)[number]['key'];

export const defaultAlertColumns: AlertColumn[] = [
  'name',
  'severity',
  ...defaultVisibleAlertColumns,
];

export function parseAlertColumns(value: string | null): AlertColumn[] {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (
      !Array.isArray(parsed) ||
      !parsed.includes('name') ||
      !parsed.includes('severity') ||
      // types key as AlertColumn
      !parsed.every((key): key is AlertColumn => alertColumns.some((column) => column.key === key))
    ) {
      return defaultAlertColumns;
    }
    return [...new Set(parsed)];
  } catch {
    return defaultAlertColumns;
  }
}
