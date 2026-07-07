import * as _ from 'lodash-es';

import type { PanelDefinition } from '@perses-dev/core';
import { MONITORING_DASHBOARDS_DEFAULT_TIMESPAN } from '../../features/legacy-dashboards/utils/utils';
import { Alert, PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { Silences } from '../types/types';
import {
  DaysFilters,
  IncidentSeverityFilters,
  IncidentStateFilters,
} from '../../features/incidents/types/model';
import { Variable } from '../../features/legacy-dashboards/components/legacy-variable-dropdowns';

export type RootState = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  k8s: { [key: string]: any };
  observe: LegacyObserveState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UI: any;
  plugins: {
    mcp?: ObserveState;
    mp?: ObserveState;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegacyObserveState = Map<string, any>;
export type ObserveState = {
  dashboards: {
    legacy: {
      [dashboardName: string]: {
        variables: Record<string, Variable>;
      };
    };
    isOpened: boolean;
    addPersesPanelExternally: PanelDefinition | null;
  };
  incidentsData: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    incidents: Array<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alertsData: Array<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alertsTableData: Array<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filteredIncidentsData: Array<any>;
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
    isOpened: false,
    addPersesPanelExternally: null,
    legacy: {},
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  series: any;
  disabledSeries: PrometheusLabels[];
  queryTableData: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
