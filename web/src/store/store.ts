import * as _ from 'lodash-es';

import { MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../components/dashboards/legacy/utils';
import { Alert, PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { Silences } from '../components/types';
import {
  DaysFilters,
  IncidentSeverityFilters,
  IncidentStateFilters,
  IncidentsTimestamps,
  AlertsTimestamps,
} from '../components/Incidents/model';
import { Variable } from '../components/dashboards/legacy/legacy-variable-dropdowns';

export type RootState = {
  k8s: { [key: string]: any };
  observe: LegacyObserveState;
  UI: any;
  plugins: {
    mcp?: ObserveState;
    mp?: ObserveState;
  };
};

export type LegacyObserveState = Map<string, any>;
export type ObserveState = {
  dashboards: {
    endTime?: number;
    pollInterval: number;
    timespan: number;
    variables: Record<string, Variable>;
  };
  incidentsData: {
    incidents: Array<any>;
    alertsData: Array<any>;
    alertsTableData: Array<any>;
    filteredIncidentsData: Array<any>;
    incidentsTimestamps: IncidentsTimestamps;
    alertsTimestamps: AlertsTimestamps;
    alertsAreLoading: boolean;
    incidentsChartSelectedId: string;
    incidentsInitialState: {
      days: Array<DaysFilters>;
      severity: Array<IncidentSeverityFilters>;
      state: Array<IncidentStateFilters>;
      groupId: Array<string>;
    };
    incidentsActiveFilters: {
      days: Array<DaysFilters>;
      severity: Array<IncidentSeverityFilters>;
      state: Array<IncidentStateFilters>;
      groupId: Array<string>;
    };
    incidentPageFilterType: string;
    incidentsLastRefreshTime: number | null;
  };
  queryBrowser: {
    pollInterval: string | null;
    queries: Array<QueryStructure>;
    timespan: number;
    dismissNamespaceAlert: boolean;
    lastRequestTime: number;
  };
  alerting: { [datasource: string]: { [identifier: string]: AlertsInfo | undefined } | undefined };
  hideGraphs: boolean;
};

export const defaultObserveState: ObserveState = {
  dashboards: {
    endTime: null,
    pollInterval: 30 * 1000,
    timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
    variables: {},
  },
  queryBrowser: {
    pollInterval: null,
    queries: [newQueryBrowserQuery()],
    timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
    dismissNamespaceAlert: false,
    lastRequestTime: Date.now(),
  },
  incidentsData: {
    incidents: [],
    alertsData: [],
    alertsTableData: [],
    filteredIncidentsData: [],
    incidentsTimestamps: { minOverTime: [], lastOverTime: [] },
    alertsTimestamps: { minOverTime: [], lastOverTime: [] },
    alertsAreLoading: true,
    incidentsChartSelectedId: '',
    incidentsInitialState: {
      days: ['7 days'],
      severity: ['Critical', 'Warning'],
      state: ['Firing'],
      groupId: [],
    },
    incidentsActiveFilters: {
      days: [],
      severity: [],
      state: [],
      groupId: [],
    },
    incidentPageFilterType: 'Severity',
    incidentsLastRefreshTime: null,
  },
  alerting: {},
  hideGraphs: false,
};

export type MonitoringState = {
  observe: LegacyObserveState;
  plugins: {
    mcp: ObserveState;
    mp: ObserveState;
  };
};

export type QueryStructure = {
  id: string;
  isEnabled: boolean;
  isExpanded: boolean;
  text: string;
  query: string;
  series: any;
  disabledSeries: PrometheusLabels[];
  queryTableData: {
    columns: any;
    rows: any;
  };
};

export type AlertsInfo = {
  alertCount: number;
  loaded: boolean;
  loadError: Error | null;
  alerts: Array<Alert>;
  rules: Array<Rule>;
  silences: Silences;
};

export function newAlertsInfo(): AlertsInfo {
  return {
    alertCount: 0,
    loaded: false,
    loadError: null,
    alerts: [],
    rules: [],
    silences: {
      data: [],
      loaded: false,
    },
  };
}

export function newQueryBrowserQuery(): QueryStructure {
  return {
    id: _.uniqueId('query-browser-query'),
    isEnabled: true,
    isExpanded: true,
    text: '',
    query: '',
    series: [],
    disabledSeries: [],
    queryTableData: { columns: [], rows: [] },
  };
}
