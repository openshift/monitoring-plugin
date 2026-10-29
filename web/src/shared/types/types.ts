import { Alert, PrometheusLabels, Silence } from '@openshift-console/dynamic-plugin-sdk';

export const enum AlertSource {
  Platform = 'platform',
  User = 'user',
}

export type MonitoringResource = {
  group: string;
  resource: string;
  abbr: string;
  kind: string;
  label: string;
  url: string;
  virtUrl: string;
};

export type Silences = {
  data: Silence[];
  loaded: boolean;
  loadError?: string | Error;
};

export type Alerts = {
  data: Alert[];
  loaded: boolean;
  loadError?: string | Error;
};

export type PrometheusAPIError = {
  json: {
    error?: string;
  };
  message?: string;
  response: {
    status: number;
  };
};

export type Target = {
  discoveredLabels: PrometheusLabels;
  globalUrl: string;
  health: 'up' | 'down';
  labels: PrometheusLabels;
  lastError: string;
  lastScrape: string;
  lastScrapeDuration: number;
  scrapePool: string;
  scrapeUrl: string;
};

export type TimeRange = {
  endTime: number;
  duration: number;
};

export type Variable = {
  isHidden?: boolean;
  isLoading?: boolean;
  includeAll?: boolean;
  options?: string[];
  query?: string;
  value?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasource?: any;
};

export type DaysFilters = '1 day' | '3 days' | '7 days' | '15 days';

export type IncidentStateFilters = 'Resolved' | 'Firing';

export type IncidentSeverityFilters = 'Critical' | 'Warning' | 'Informative';

export type AggregatedAlert = {
  severity: Alert['labels']['severity'];
  alerts: Alert[];
  name: Alert['labels']['alertname'];
  state: Alert['state'];
};

export type PatternflyToken = {
  name: string;
  value: string;
  var: string;
};
