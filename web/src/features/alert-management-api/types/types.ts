import { Alert, AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';

export type ManagedAlert = Alert & {
  alertScope: string;
  component: string;
  source: string;
};

export type AlertFilters = {
  name: string;
  scope: string[];
  component: string[];
  severity: string[];
  state: AlertStates[];
  source: string[];
  namespace: string[];
  labels: string[];
  firingTime: string;
};

// To be replaced once the backend returns alertingRuleEnabled.
export type RuleWithEnablement = Rule & { alertingRuleEnabled?: boolean | null };

export type ManagedRule = RuleWithEnablement & {
  enablement: 'Enabled' | 'Disabled' | 'Unknown';
  firingAlertCount: number;
  silencedAlertCount: number;
  pendingAlertCount: number;
  scope: string;
  component: string;
  source: string;
  severity: string;
  namespace: string;
  managedBy: string;
};

export type RuleFilters = {
  name: string;
  labels: string[];
  enablement: string[];
  alertStates: string[];
  severity: string[];
  scope: string[];
  component: string[];
  source: string[];
  namespace: string[];
  managedBy: string[];
};

export type RuleFilterKey = keyof Omit<RuleFilters, 'name'>;

export type AlertFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AggregatedAlert = {
  key: string;
  name: string;
  severity: string;
  alertScope: string;
  component: string;
  source: string;
  state: string[];
  firingAlertCount: number;
  pendingAlertCount: number;
  silencedAlertCount: number;
  alerts: ManagedAlert[];
};

export type TableSort<Column extends string> = {
  column: Column;
  direction: 'asc' | 'desc';
};

export type AlertManagementData = {
  rules: Rule[];
  alerts: ManagedAlert[];
};
