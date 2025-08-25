import * as _ from 'lodash-es';

import { Perspective } from './actions';

import { MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../components/dashboards/legacy/utils';
import { Alert, PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { Silences } from '../components/types';
import { DaysFilters, IncidentFilters } from '../components/Incidents/model';
import { Variable } from '../components/dashboards/legacy/legacy-variable-dropdowns';

type Namespace = '#ALL_NS#' | string;

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
  dashboards: Record<
    Perspective,
    {
      endTime: string | null;
      pollInterval: number;
      timespan: number;
      variables: Record<string, Variable>;
    }
  >;
  incidentsData: {
    incidents: Array<any>;
    alertsData: Array<any>;
    alertsTableData: Array<any>;
    filteredIncidentsData: Array<any>;
    alertsAreLoading: boolean;
    incidentsChartSelectedId: string;
    incidentsInitialState: {
      days: Array<DaysFilters>;
      incidentFilters: Array<IncidentFilters>;
    };
    incidentsActiveFilters: {
      days: Array<DaysFilters>;
      incidentFilters: Array<IncidentFilters>;
    };
    groupId: string;
  };
  queryBrowser: {
    metrics: Array<any>;
    pollInterval: string | null;
    queries: Array<QueryStructure>;
    timespan: number;
    dismissNamespaceAlert: boolean;
    lastRequestTime: number;
  };
  alerting: Record<
    Namespace,
    {
      alertCount: number;
      loaded: boolean;
      loadError: Error | null;
      alerts: Array<Alert>;
      rules: Array<Rule>;
      silences: Silences;
    }
  >;
  hideGraphs: boolean;
};

export const defaultObserveState: ObserveState = {
  dashboards: {
    dev: {
      endTime: null,
      pollInterval: 30 * 1000,
      timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
      variables: {},
    },
    admin: {
      endTime: null,
      pollInterval: 30 * 1000,
      timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
      variables: {},
    },
  } as Record<
    Perspective,
    {
      endTime: string | null;
      pollInterval: number;
      timespan: number;
      variables: Record<string, Variable>;
    }
  >,
  queryBrowser: {
    metrics: [] as Array<any>,
    pollInterval: null,
    queries: [newQueryBrowserQuery()],
    timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
    dismissNamespaceAlert: false,
    lastRequestTime: Date.now(),
  },
  incidentsData: {
    incidents: [] as Array<any>,
    alertsData: [] as Array<any>,
    alertsTableData: [] as Array<any>,
    filteredIncidentsData: [] as Array<any>,
    alertsAreLoading: true,
    incidentsChartSelectedId: '',
    incidentsInitialState: {
      days: ['7 days'] as Array<DaysFilters>,
      incidentFilters: ['Critical', 'Warning', 'Firing'] as Array<IncidentFilters>,
    },
    incidentsActiveFilters: {
      days: [] as Array<DaysFilters>,
      incidentFilters: [] as Array<IncidentFilters>,
    },
    groupId: '',
  },
  alerting: {} as Record<
    string,
    {
      alertCount: number;
      loaded: boolean;
      loadError: Error | null;
      alerts: Array<Alert>;
      rules: Array<Rule>;
      silences: Silences;
    }
  >,
  hideGraphs: false as boolean,
};

export type MonitoringState = {
  observe: LegacyObserveState;
  plugins: {
    mcp?: ObserveState;
    mp?: ObserveState;
  };
};

export type QueryStructure = {
  id: string;
  isEnabled: boolean;
  isExpanded: boolean;
  text?: string;
  query?: string;
  series?: any;
  disabledSeries?: PrometheusLabels[];
  queryTableData?: {
    columns: any;
    rows: any;
  };
};

export function newQueryBrowserQuery(): QueryStructure {
  return {
    id: _.uniqueId('query-browser-query'),
    isEnabled: true,
    isExpanded: true,
  };
}
