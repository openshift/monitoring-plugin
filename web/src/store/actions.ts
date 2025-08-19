import { action, ActionType as Action } from 'typesafe-actions';

import { Alert, Rule, Silence } from '@openshift-console/dynamic-plugin-sdk';

export enum ActionType {
  AlertingSetLoading = 'v2/AlertingSetLoading',
  AlertingSetRulesLoaded = 'v2/AlertingSetRulesLoaded',
  AlertingSetSilencesLoaded = 'v2/AlertingSetSilencesLoaded',
  AlertingApplySilences = 'v2/AlertingApplySilences',
  AlertingSetErrored = 'v2/AlertingSetErrored',
  AlertingSetSilencesErrored = 'v2/AlertingSetSilencesErrored',
  DashboardsPatchAllVariables = 'dashboardsPatchAllVariables',
  DashboardsPatchVariable = 'dashboardsPatchVariable',
  DashboardsClearVariables = 'dashboardsClearVariables',
  DashboardsSetEndTime = 'dashboardsSetEndTime',
  DashboardsSetPollInterval = 'dashboardsSetPollInterval',
  DashboardsSetTimespan = 'dashboardsSetTimespan',
  DashboardsVariableOptionsLoaded = 'dashboardsVariableOptionsLoaded',
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
  SetAlertCount = 'mpSetAlertCount',
  ToggleGraphs = 'toggleGraphs',
  ShowGraphs = 'mpShowGraphs',
  SetIncidents = 'setIncidents',
  SetIncidentsActiveFilters = 'setIncidentsActiveFilters',
  SetChooseIncident = 'setChooseIncident',
  SetAlertsData = 'mpSetAlertsData',
  SetAlertsTableData = 'mpSetAlertsTableData',
  SetAlertsAreLoading = 'mpSetAlertsAreLoading',
  SetIncidentsChartSelection = 'mpSetIncidentsChartSelection',
  SetFilteredIncidentsData = 'mpSetFilteredIncidentsData',
}

export type Perspective = 'admin' | 'dev' | 'acm' | 'virtualization-perspective';
// export type alertKey = 'alerts' | 'devAlerts' | 'acmAlerts' | 'virtAlerts';
// export type silencesKey = 'silences' | 'devSilences' | 'acmSilences' | 'virtSilences';
// export type rulesKey = 'rules' | 'devRules' | 'acmRules' | 'notificationAlerts' | 'virtRules';

// type AlertingKey = alertKey | silencesKey | rulesKey;

export const dashboardsPatchVariable = (key: string, patch: any, perspective: Perspective) =>
  action(ActionType.DashboardsPatchVariable, { key, patch, perspective });

export const dashboardsPatchAllVariables = (variables: any, perspective: Perspective) =>
  action(ActionType.DashboardsPatchAllVariables, { variables, perspective });

export const DashboardsClearVariables = (perspective: Perspective) =>
  action(ActionType.DashboardsClearVariables, { perspective });

export const dashboardsSetEndTime = (endTime: number, perspective: Perspective) =>
  action(ActionType.DashboardsSetEndTime, { endTime, perspective });

export const dashboardsSetPollInterval = (pollInterval: number, perspective: Perspective) =>
  action(ActionType.DashboardsSetPollInterval, { pollInterval, perspective });

export const dashboardsSetTimespan = (timespan: number, perspective: Perspective) =>
  action(ActionType.DashboardsSetTimespan, { timespan, perspective });

export const dashboardsVariableOptionsLoaded = (
  key: string,
  newOptions: string[],
  perspective: Perspective,
) => action(ActionType.DashboardsVariableOptionsLoaded, { key, newOptions, perspective });

export const alertingSetLoading = (namespace: string) =>
  action(ActionType.AlertingSetLoading, {
    namespace,
    data: { loaded: false, loadError: null },
  });

export const alertingSetRulesLoaded = (namespace: string, rules: Rule[], alerts: Alert[]) =>
  action(ActionType.AlertingSetRulesLoaded, { namespace, rules, alerts });

export const alertingSetSilencesLoaded = (namespace: string, silences: Silence[]) =>
  action(ActionType.AlertingSetSilencesLoaded, {
    namespace,
    silences,
  });

// New action to trigger the reducer logic
export const alertingApplySilences = (namespace: string) =>
  action(ActionType.AlertingApplySilences, { namespace });

export const alertingSetErrored = (namespace: string, loadError: Error) =>
  action(ActionType.AlertingSetErrored, {
    namespace,
    data: { loaded: true, loadError },
  });

export const alertingSetSilencesErrored = (namespace: string, loadError: Error) =>
  action(ActionType.AlertingSetSilencesErrored, {
    namespace,
    data: { loaded: true, loadError },
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

export const setAlertCount = (namespace: string, alertCount: number) =>
  action(ActionType.SetAlertCount, { alertCount, namespace });

export const setIncidents = (incidents) => action(ActionType.SetIncidents, incidents);

export const setIncidentsActiveFilters = (incidentsActiveFilters) =>
  action(ActionType.SetIncidentsActiveFilters, incidentsActiveFilters);

export const setChooseIncident = (groupId) => action(ActionType.SetChooseIncident, groupId);

export const setAlertsData = (alertsData) => action(ActionType.SetAlertsData, alertsData);

export const setAlertsTableData = (alertsTableData) =>
  action(ActionType.SetAlertsTableData, alertsTableData);

export const setAlertsAreLoading = (alertsAreLoading) =>
  action(ActionType.SetAlertsAreLoading, alertsAreLoading);

export const setIncidentsChartSelection = (incidentsChartSelectedId) =>
  action(ActionType.SetIncidentsChartSelection, incidentsChartSelectedId);

export const setFilteredIncidentsData = (filteredIncidentsData) =>
  action(ActionType.SetFilteredIncidentsData, filteredIncidentsData);

type Actions = {
  AlertingSetErrored: typeof alertingSetErrored;
  AlertingSetLoading: typeof alertingSetLoading;
  AlertingSetSilencesErrored: typeof alertingSetSilencesErrored;
  AlertingSetRulesLoaded: typeof alertingSetRulesLoaded;
  AlertingSetSilencesLoaded: typeof alertingSetSilencesLoaded;
  AlertingApplySilences: typeof alertingApplySilences;
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
  setChooseIncident: typeof setChooseIncident;
  setAlertsData: typeof setAlertsData;
  setAlertsTableData: typeof setAlertsTableData;
  setAlertsAreLoading: typeof setAlertsAreLoading;
  setIncidentsChartSelection: typeof setIncidentsChartSelection;
  setFilteredIncidentsData: typeof setFilteredIncidentsData;
};

export type ObserveAction = Action<Actions>;
