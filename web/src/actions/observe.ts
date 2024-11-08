import { action, ActionType as Action } from 'typesafe-actions';

import { Rule } from '@openshift-console/dynamic-plugin-sdk';

export enum ActionType {
  AlertingSetData = 'alertingSetData',
  AlertingSetRules = 'alertingSetRules',
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
  SetAlertCount = 'SetAlertCount',
  ToggleGraphs = 'toggleGraphs',
  SetIncidentsActiveFilters = 'setIncidentsActiveFilters',
  SetChooseIncident = 'setChooseIncident',
}

export type Perspective = 'admin' | 'dev' | 'acm';
export type alertKey = 'alerts' | 'devAlerts' | 'acmAlerts';
export type silencesKey = 'silences' | 'devSilences' | 'acmSilences';
export type rulesKey = 'rules' | 'devRules' | 'acmRules' | 'notificationAlerts';

type AlertingKey = alertKey | silencesKey | rulesKey;

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

export const alertingLoading = (key: AlertingKey, perspective: Perspective) =>
  action(ActionType.AlertingSetData, {
    key,
    data: { loaded: false, loadError: null, data: null, perspective },
  });

export const alertingLoaded = (key: AlertingKey, alerts: any, perspective: Perspective) =>
  action(ActionType.AlertingSetData, {
    key,
    data: { loaded: true, loadError: null, data: alerts, perspective },
  });

export const alertingErrored = (key: AlertingKey, loadError: Error, perspective: Perspective) =>
  action(ActionType.AlertingSetData, {
    key,
    data: { loaded: true, loadError, data: null, perspective },
  });

export const alertingSetRules = (key: rulesKey, rules: Rule[], perspective: Perspective) =>
  action(ActionType.AlertingSetRules, { key, data: rules, perspective });

export const toggleGraphs = () => action(ActionType.ToggleGraphs);

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

export const setAlertCount = (alertCount) => action(ActionType.SetAlertCount, { alertCount });

export const setIncidentsActiveFilters = (incidentsActiveFilters) =>
  action(ActionType.SetIncidentsActiveFilters, incidentsActiveFilters);

export const setChooseIncident = (incidentGroupId) =>
  action(ActionType.SetChooseIncident, incidentGroupId);

const actions = {
  alertingErrored,
  alertingLoaded,
  alertingLoading,
  alertingSetRules,
  dashboardsPatchAllVariables,
  dashboardsPatchVariable,
  DashboardsClearVariables,
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  dashboardsVariableOptionsLoaded,
  queryBrowserAddQuery,
  queryBrowserDuplicateQuery,
  queryBrowserDeleteAllQueries,
  queryBrowserDeleteAllSeries,
  queryBrowserDeleteQuery,
  queryBrowserDismissNamespaceAlert,
  queryBrowserPatchQuery,
  queryBrowserRunQueries,
  queryBrowserSetAllExpanded,
  queryBrowserSetMetrics,
  queryBrowserSetPollInterval,
  queryBrowserSetTimespan,
  queryBrowserToggleAllSeries,
  queryBrowserToggleIsEnabled,
  queryBrowserToggleSeries,
  setAlertCount,
  toggleGraphs,
  setIncidentsActiveFilters,
  setChooseIncident,
};

export type ObserveAction = Action<typeof actions>;
