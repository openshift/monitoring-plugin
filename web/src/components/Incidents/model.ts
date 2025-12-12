import { RuleStates, Silence } from '@openshift-console/dynamic-plugin-sdk';

export type Timestamps = [number, string];

export type SpanDates = Array<number>;

export type AlertsIntervalsArray = [number, number, 'data' | 'nodata'];

export type Incident = {
  component: string;
  componentList: Array<string>;
  layer: string;
  firing: boolean;
  group_id: string;
  src_severity: string;
  src_alertname: string;
  src_namespace: string;
  silenced: boolean;
  x: number;
  values: Array<Timestamps>;
  metric: Metric;
};

// Define the interface for Metric
export type Metric = {
  group_id: string; // The unique ID for grouping
  component: string; // Component name
  componentList?: string[]; // List of all unique components
  [key: string]: any; // Allow other dynamic fields in Metric
};

export type ProcessedIncident = Incident & {
  resolved: boolean;
  firing: boolean;
};

export type Alert = {
  alertname: string;
  alertsStartFiring: number;
  alertsEndFiring: number;
  alertstate: string;
  component: string;
  layer: string;
  name: string;
  namespace: string;
  resolved: boolean;
  severity: Severity;
  silenced: boolean;
  x: number;
  values: Array<Timestamps>;
  alertsExpandedRowData?: Array<Alert>;
};

export type DaysFilters = '1 day' | '3 days' | '7 days' | '15 days';

export type IncidentStateFilters = 'Resolved' | 'Firing';

export type IncidentSeverityFilters = 'Critical' | 'Warning' | 'Informative';

export type Severity = 'critical' | 'warning' | 'info';

export type IncidentFilterSelectionCombined =
  | 'Critical'
  | 'Warning'
  | 'Informative'
  | 'Resolved'
  | 'Firing';

export type IncidentFiltersCombined = {
  days: Array<DaysFilters>;
  groupId?: Array<string>;
  severity?: Array<IncidentSeverityFilters>;
  state?: Array<IncidentStateFilters>;
};

export type IncidentsPageFiltersExpandedState = {
  severity: boolean;
  state: boolean;
  groupId: boolean;
};

export type GroupedAlert = {
  component: string;
  alertstate: 'firing' | 'resolved' | 'silenced';
  layer: string;
  warning: number;
  info: number;
  critical: number;
  alertsExpandedRowData: Array<IncidentsDetailsAlert>;
};

export type IncidentsDetailsAlert = {
  alertname: string;
  alertsStartFiring: number;
  alertsEndFiring: number;
  alertstate: string;
  component: string;
  layer: string;
  name: string;
  namespace: string;
  resolved: boolean;
  severity: Severity;
  x: number;
  values: Array<Timestamps>;
  silenced: boolean;
  rule: {
    alerts: any[];
    annotations: { [key: string]: string };
    type: string;
    state: RuleStates;
    name: string;
    query: string;
    duration: number;
    labels: { [key: string]: string };
    id: string;
    sourceId?: string;
    silencedBy?: Silence[];
    [key: string]: any;
  };
};

export type AlertsChartBar = {
  y0: string;
  y: string;
  x: number;
  severity: 'Info' | 'Warning' | 'Critical';
  name: string;
  namespace: string;
  layer: string;
  component: string;
  nodata: boolean;
  alertstate: 'resolved' | 'firing';
  silenced: boolean;
  fill: string;
};
