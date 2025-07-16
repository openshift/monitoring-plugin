export type Timestamps = [Date, string];

export type SpanDates = Array<Date>;

export type AlertsIntervalsArray = [Date, Date, 'data' | 'nodata'];

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

export type ProcessedIncident = Omit<Incident, 'metric'> & {
  informative: boolean;
  critical: boolean;
  warning: boolean;
  resolved: boolean;
  firing: boolean;
};

export type Alert = {
  alertname: string;
  alertsStartFiring: Date;
  alertsEndFiring: Date;
  alertstate: string;
  component: string;
  layer: string;
  name: string;
  namespace: string;
  resolved: boolean;
  severity: 'critical' | 'warning' | 'info';
  x: number;
  values: Array<Timestamps>;
};

export type DaysFilters = '1 day' | '3 days' | '7 days' | '15 days';

export type IncidentFilters = 'Critical' | 'Warning' | 'Firing' | 'Informative' | 'Resolved';

export type IncidentFiltersCombined = {
  days: Array<DaysFilters>;
  incidentFilters: Array<IncidentFilters>;
  groupId?: Array<string>;
};
