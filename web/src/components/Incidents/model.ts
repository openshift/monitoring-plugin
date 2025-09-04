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
  informative: boolean;
  critical: boolean;
  warning: boolean;
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
  x: number;
  values: Array<Timestamps>;
  alertsExpandedRowData?: Array<Alert>;
};

export type DaysFilters = '1 day' | '3 days' | '7 days' | '15 days';

export type IncidentFilters = 'Critical' | 'Warning' | 'Firing' | 'Informative' | 'Resolved';

export type Severity = 'critical' | 'warning' | 'info';

export type IncidentFiltersCombined = {
  days: Array<DaysFilters>;
  groupId?: Array<string>;
  severity?: Array<string>;
  state?: Array<string>;
};

export type IncidentsPageFiltersExpandedState = {
  severity: boolean;
  state: boolean;
  groupId: boolean;
};
