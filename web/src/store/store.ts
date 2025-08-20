import * as _ from 'lodash-es';
import { Map, MapOf, List } from 'immutable';

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
export type ObserveState = MapOf<{
  dashboards: Map<
    Perspective,
    MapOf<{
      endTime: string | null;
      pollInterval: number;
      timespan: number;
      variables: Map<string, Variable>;
    }>
  >;
  incidentsData: MapOf<{
    incidents: Array<any>;
    alertsData: Array<any>;
    alertsTableData: Array<any>;
    filteredIncidentsData: Array<any>;
    alertsAreLoading: boolean;
    incidentsChartSelectedId: string;
    incidentsInitialState: MapOf<{
      days: Array<DaysFilters>;
      incidentFilters: Array<IncidentFilters>;
    }>;
    incidentsActiveFilters: MapOf<{
      days: Array<DaysFilters>;
      incidentFilters: Array<IncidentFilters>;
    }>;
    groupId: string;
  }>;
  queryBrowser: MapOf<{
    metrics: Array<any>;
    pollInterval: string | null;
    queries: List<MapOf<QueryStructure>>;
    timespan: number;
  }>;
  alerting: Map<
    Namespace,
    MapOf<{
      alertCount: number;
      loaded: boolean;
      loadError: Error | null;
      alerts: Array<Alert>;
      rules: Array<Rule>;
      silences: MapOf<Silences>;
    }>
  >;
  hideGraphs: boolean;
}>;

export const defaultObserveState: ObserveState = Map({
  dashboards: Map<Perspective, MapOf<any>>([
    [
      'dev',
      Map({
        endTime: null,
        pollInterval: 30 * 1000,
        timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
        variables: Map(),
      }),
    ],
    [
      'admin',
      Map({
        endTime: null,
        pollInterval: 30 * 1000,
        timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
        variables: Map(),
      }),
    ],
  ]),
  queryBrowser: Map({
    metrics: [] as Array<any>,
    pollInterval: null,
    queries: List([newQueryBrowserQuery()]),
    timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
  }),
  incidentsData: Map({
    incidents: [] as Array<any>,
    alertsData: [] as Array<any>,
    alertsTableData: [] as Array<any>,
    filteredIncidentsData: [] as Array<any>,
    alertsAreLoading: true,
    incidentsChartSelectedId: '',
    incidentsInitialState: Map({
      days: ['7 days'] as Array<DaysFilters>,
      incidentFilters: ['Critical', 'Warning', 'Firing'] as Array<IncidentFilters>,
    }),
    incidentsActiveFilters: Map({
      days: [] as Array<DaysFilters>,
      incidentFilters: [] as Array<IncidentFilters>,
    }),
    groupId: '',
  }),
  alerting: Map<Namespace, MapOf<any>>([]),
  hideGraphs: false as boolean,
});

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

export function newQueryBrowserQuery(): MapOf<{
  id: string;
  isEnabled: boolean;
  isExpanded: boolean;
}> {
  return Map({
    id: _.uniqueId('query-browser-query'),
    isEnabled: true,
    isExpanded: true,
  });
}
