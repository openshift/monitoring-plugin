export const selectedAlertFilterLabels = {
  scope: 'Alert scope',
  severity: 'Severity',
  namespace: 'Namespace',
  labels: 'Alert labels',
  component: 'Affected component',
  state: 'State',
  source: 'Source',
} as const;

export type SelectedAlertFilterKey = keyof typeof selectedAlertFilterLabels;
