import { Alert, AlertStates, Silence } from '@openshift-console/dynamic-plugin-sdk';

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
  alerts: ManagedAlert[];
};

export type AlertManagementData = {
  alerts: ManagedAlert[];
  silences: Silence[];
};
