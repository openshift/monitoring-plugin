import { action, ActionType as Action } from 'typesafe-actions';

import { Alert, Rule, Silence } from '@openshift-console/dynamic-plugin-sdk';

export enum ActionType {
  AlertingSetLoading = 'v2/AlertingSetLoading',
  AlertingSetRulesLoaded = 'v2/AlertingSetRulesLoaded',
  AlertingSetSilencesLoaded = 'v2/AlertingSetSilencesLoaded',
  AlertingApplySilences = 'v2/AlertingApplySilences',
  AlertingSetErrored = 'v2/AlertingSetErrored',
  AlertingSetSilencesErrored = 'v2/AlertingSetSilencesErrored',
  AlertingClearSelectorData = 'v2/AlertingClearSelectorData',
  DashboardsPatchAllVariables = 'v2/dashboardsPatchAllVariables',
  DashboardsPatchVariable = 'v2/dashboardsPatchVariable',
  DashboardsClearVariables = 'v2/dashboardsClearVariables',
  DashboardsSetEndTime = 'v2/dashboardsSetEndTime',
  DashboardsSetPollInterval = 'v2/dashboardsSetPollInterval',
  DashboardsSetTimespan = 'v2/dashboardsSetTimespan',
  DashboardsVariableOptionsLoaded = 'v2/dashboardsVariableOptionsLoaded',
  QueryBrowserAddQuery = 'queryBrowserAddQuery',
  QueryBrowserDuplicateQuery = 'queryBrowserDuplicateQuery',
  QueryBrowserDeleteAllQueries = 'queryBrowserDeleteAllQueries',
  QueryBrowserDeleteAllSeries = 'queryBrowserDeleteAllSeries',
  QueryBrowserDeleteQuery = 'queryBrowserDeleteQuery',
  QueryBrowserDismissNamespaceAlert = 'queryBrowserDismissNamespaceAlert',
  QueryBrowserPatchQuery = 'queryBrowserPatchQuery',
  QueryBrowserRunQueries = 'queryBrowserRunQueries',
  QueryBrowserSetAllExpanded = 'queryBrowserSetAllExpanded',
  QueryBrowserSetMetrics = 'queryBrowserSetMetrics',
  QueryBrowserSetPollInterval = 'queryBrowserSetPollInterval',
  QueryBrowserSetTimespan = 'queryBrowserSetTimespan',
  QueryBrowserToggleIsEnabled = 'queryBrowserToggleIsEnabled',
  QueryBrowserToggleSeries = 'queryBrowserToggleSeries',
  QueryBrowserToggleAllSeries = 'queryBrowserToggleAllSeries',
  SetAlertCount = 'v2/SetAlertCount',
  ToggleGraphs = 'toggleGraphs',
  ShowGraphs = 'v2/ShowGraphs',
  SetIncidents = 'setIncidents',
  SetIncidentsActiveFilters = 'setIncidentsActiveFilters',
  SetAlertsData = 'setAlertsData',
  SetAlertsTableData = 'setAlertsTableData',
  SetAlertsAreLoading = 'setAlertsAreLoading',
  SetIncidentsChartSelection = 'setIncidentsChartSelection',
  SetFilteredIncidentsData = 'setFilteredIncidentsData',
  SetIncidentPageFilterType = 'setIncidentPageFilterType',
}

export type Perspective = 'admin' | 'dev' | 'acm' | 'virtualization-perspective';

export const dashboardsPatchVariable = (key: string, patch: any) =>
  action(ActionType.DashboardsPatchVariable, { key, patch });

export const dashboardsPatchAllVariables = (variables: any) =>
  action(ActionType.DashboardsPatchAllVariables, { variables });

export const DashboardsClearVariables = () => action(ActionType.DashboardsClearVariables, {});

export const dashboardsSetEndTime = (endTime: number) =>
  action(ActionType.DashboardsSetEndTime, { endTime });

export const dashboardsSetPollInterval = (pollInterval: number) =>
  action(ActionType.DashboardsSetPollInterval, { pollInterval });

export const dashboardsSetTimespan = (timespan: number) =>
  action(ActionType.DashboardsSetTimespan, { timespan });

export const dashboardsVariableOptionsLoaded = (key: string, newOptions: string[]) =>
  action(ActionType.DashboardsVariableOptionsLoaded, { key, newOptions });

export const alertingSetLoading = (datasource: string, identifier: string) =>
  action(ActionType.AlertingSetLoading, {
    datasource,
    identifier,
    data: { loaded: false, loadError: null },
  });

export const alertingSetRulesLoaded = (
  datasource: string,
  identifier: string,
  rules: Rule[],
  alerts: Alert[],
) => action(ActionType.AlertingSetRulesLoaded, { datasource, identifier, rules, alerts });

export const alertingSetSilencesLoaded = (
  datasource: string,
  identifier: string,
  silences: Silence[],
) =>
  action(ActionType.AlertingSetSilencesLoaded, {
    datasource,
    identifier,
    silences,
  });

// New action to trigger the reducer logic
export const alertingApplySilences = (datasource: string, identifier: string) =>
  action(ActionType.AlertingApplySilences, { datasource, identifier });

export const alertingSetErrored = (datasource: string, identifier: string, loadError: Error) =>
  action(ActionType.AlertingSetErrored, {
    datasource,
    identifier,
    loadError,
  });

export const alertingSetSilencesErrored = (
  datasource: string,
  identifier: string,
  loadError: Error,
) =>
  action(ActionType.AlertingSetSilencesErrored, {
    datasource,
    identifier,
    loadError,
  });

export const alertingClearSelectorData = (datasource: string, identifier: string) =>
  action(ActionType.AlertingClearSelectorData, {
    datasource,
    identifier,
  });

export const toggleGraphs = () => action(ActionType.ToggleGraphs);

export const showGraphs = () => action(ActionType.ShowGraphs);

export const queryBrowserAddQuery = () => action(ActionType.QueryBrowserAddQuery);

export const queryBrowserDuplicateQuery = (index: number) =>
  action(ActionType.QueryBrowserDuplicateQuery, { index });

export const queryBrowserDeleteAllQueries = () => action(ActionType.QueryBrowserDeleteAllQueries);

export const queryBrowserDeleteAllSeries = () => action(ActionType.QueryBrowserDeleteAllSeries);

export const queryBrowserDismissNamespaceAlert = () =>
  action(ActionType.QueryBrowserDismissNamespaceAlert);

export const queryBrowserDeleteQuery = (index: number) =>
  action(ActionType.QueryBrowserDeleteQuery, { index });

export const queryBrowserPatchQuery = (index: number, patch: { [key: string]: unknown }) =>
  action(ActionType.QueryBrowserPatchQuery, { index, patch });

export const queryBrowserRunQueries = () => action(ActionType.QueryBrowserRunQueries);

export const queryBrowserSetAllExpanded = (isExpanded: boolean) =>
  action(ActionType.QueryBrowserSetAllExpanded, { isExpanded });

export const queryBrowserSetMetrics = (metrics: string[]) =>
  action(ActionType.QueryBrowserSetMetrics, { metrics });

export const queryBrowserSetPollInterval = (pollInterval: number) =>
  action(ActionType.QueryBrowserSetPollInterval, { pollInterval });

export const queryBrowserSetTimespan = (timespan: number) =>
  action(ActionType.QueryBrowserSetTimespan, { timespan });

export const queryBrowserToggleAllSeries = (index: number) =>
  action(ActionType.QueryBrowserToggleAllSeries, { index });

export const queryBrowserToggleIsEnabled = (index: number) =>
  action(ActionType.QueryBrowserToggleIsEnabled, { index });

export const queryBrowserToggleSeries = (index: number, labels: { [key: string]: unknown }) =>
  action(ActionType.QueryBrowserToggleSeries, { index, labels });

export const setAlertCount = (datasource: string, identifier: string, alertCount: number) =>
  action(ActionType.SetAlertCount, { alertCount, datasource, identifier });

export const setIncidents = (incidents) => action(ActionType.SetIncidents, incidents);

export const setIncidentsActiveFilters = (incidentsActiveFilters) =>
  action(ActionType.SetIncidentsActiveFilters, incidentsActiveFilters);

export const setAlertsData = (alertsData) => action(ActionType.SetAlertsData, alertsData);

export const setAlertsTableData = (alertsTableData) =>
  action(ActionType.SetAlertsTableData, alertsTableData);

export const setAlertsAreLoading = (alertsAreLoading) =>
  action(ActionType.SetAlertsAreLoading, alertsAreLoading);

export const setIncidentsChartSelection = (incidentsChartSelectedId) =>
  action(ActionType.SetIncidentsChartSelection, incidentsChartSelectedId);

export const setFilteredIncidentsData = (filteredIncidentsData) =>
  action(ActionType.SetFilteredIncidentsData, filteredIncidentsData);

export const setIncidentPageFilterType = (filterTypeSelected) =>
  action(ActionType.SetIncidentPageFilterType, filterTypeSelected);

type Actions = {
  AlertingSetErrored: typeof alertingSetErrored;
  AlertingSetLoading: typeof alertingSetLoading;
  AlertingSetSilencesErrored: typeof alertingSetSilencesErrored;
  AlertingSetRulesLoaded: typeof alertingSetRulesLoaded;
  AlertingSetSilencesLoaded: typeof alertingSetSilencesLoaded;
  AlertingApplySilences: typeof alertingApplySilences;
  AlertingClearSelectorData: typeof alertingClearSelectorData;
  dashboardsPatchAllVariables: typeof dashboardsPatchAllVariables;
  dashboardsPatchVariable: typeof dashboardsPatchVariable;
  DashboardsClearVariables: typeof DashboardsClearVariables;
  dashboardsSetEndTime: typeof dashboardsSetEndTime;
  dashboardsSetPollInterval: typeof dashboardsSetPollInterval;
  dashboardsSetTimespan: typeof dashboardsSetTimespan;
  dashboardsVariableOptionsLoaded: typeof dashboardsVariableOptionsLoaded;
  queryBrowserAddQuery: typeof queryBrowserAddQuery;
  queryBrowserDuplicateQuery: typeof queryBrowserDuplicateQuery;
  queryBrowserDeleteAllQueries: typeof queryBrowserDeleteAllQueries;
  queryBrowserDeleteAllSeries: typeof queryBrowserDeleteAllSeries;
  queryBrowserDeleteQuery: typeof queryBrowserDeleteQuery;
  queryBrowserDismissNamespaceAlert: typeof queryBrowserDismissNamespaceAlert;
  queryBrowserPatchQuery: typeof queryBrowserPatchQuery;
  queryBrowserRunQueries: typeof queryBrowserRunQueries;
  queryBrowserSetAllExpanded: typeof queryBrowserSetAllExpanded;
  queryBrowserSetMetrics: typeof queryBrowserSetMetrics;
  queryBrowserSetPollInterval: typeof queryBrowserSetPollInterval;
  queryBrowserSetTimespan: typeof queryBrowserSetTimespan;
  queryBrowserToggleAllSeries: typeof queryBrowserToggleAllSeries;
  queryBrowserToggleIsEnabled: typeof queryBrowserToggleIsEnabled;
  queryBrowserToggleSeries: typeof queryBrowserToggleSeries;
  setAlertCount: typeof setAlertCount;
  toggleGraphs: typeof toggleGraphs;
  showGraphs: typeof showGraphs;
  setIncidents: typeof setIncidents;
  setIncidentsActiveFilters: typeof setIncidentsActiveFilters;
  setAlertsData: typeof setAlertsData;
  setAlertsTableData: typeof setAlertsTableData;
  setAlertsAreLoading: typeof setAlertsAreLoading;
  setIncidentsChartSelection: typeof setIncidentsChartSelection;
  setFilteredIncidentsData: typeof setFilteredIncidentsData;
  setIncidentPageFilterType: typeof setIncidentPageFilterType;
};

export type ObserveAction = Action<Actions>;
