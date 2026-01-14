import * as _ from 'lodash-es';

import { ActionType, ObserveAction } from './actions';

import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from '../components/dashboards/legacy/utils';
import {
  defaultObserveState,
  newAlertsInfo,
  newQueryBrowserQuery,
  ObserveState,
  QueryStructure,
} from './store';
import { produce } from 'immer';
import { applySilences } from '../components/alerting/AlertUtils';

const monitoringReducer = produce((draft: ObserveState, action: ObserveAction): ObserveState => {
  if (!draft) {
    return defaultObserveState;
  }

  const queryBrowserPatchQueryHelper = (
    index: number,
    patch: Partial<QueryStructure>,
  ): QueryStructure => {
    return draft.queryBrowser.queries[index]
      ? { ...draft.queryBrowser.queries[index], ...patch }
      : { ...newQueryBrowserQuery(), ...patch };
  };

  switch (action.type) {
    case ActionType.DashboardsPatchVariable: {
      // Don't worry about checking if they key exists, since we will just write into the slot
      // regardless of if it does or doesn't
      draft.dashboards.variables[action.payload.key] = {
        ...draft.dashboards.variables[action.payload.key],
        ...action.payload.patch,
      };
      break;
    }

    case ActionType.DashboardsPatchAllVariables: {
      draft.dashboards.variables = action.payload.variables;
      break;
    }

    case ActionType.DashboardsClearVariables: {
      draft.dashboards.variables = {};
      break;
    }

    case ActionType.DashboardsSetEndTime: {
      draft.dashboards.endTime = action.payload.endTime;
      break;
    }

    case ActionType.DashboardsSetPollInterval: {
      draft.dashboards.pollInterval = action.payload.pollInterval;
      break;
    }

    case ActionType.DashboardsSetTimespan: {
      draft.dashboards.timespan = action.payload.timespan;
      break;
    }

    case ActionType.DashboardsVariableOptionsLoaded: {
      const { key, newOptions } = action.payload;
      const val = draft.dashboards.variables[key];
      const patch = _.isEqual(val?.options, newOptions)
        ? { isLoading: false }
        : {
            isLoading: false,
            options: newOptions,
            value:
              val?.value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ||
              newOptions.includes(val?.value ?? '')
                ? val?.value
                : newOptions[0],
          };
      draft.dashboards.variables[key] = { ...draft.dashboards.variables[key], ...patch };
      break;
    }

    case ActionType.AlertingSetRulesLoaded: {
      const { datasource, identifier, rules, alerts } = action.payload;

      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = newAlertsInfo();
      }

      draft.alerting[datasource][identifier] = {
        ...draft.alerting[datasource][identifier],
        rules,
        alerts,
        loaded: true,
        loadError: null,
        alertCount: alerts.length,
      };
      break;
    }

    case ActionType.AlertingSetErrored: {
      const { datasource, identifier, loadError } = action.payload;

      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = newAlertsInfo();
      }

      draft.alerting[datasource][identifier] = {
        ...draft.alerting[datasource][identifier],
        loaded: true,
        loadError,
      };
      break;
    }

    case ActionType.AlertingSetSilencesErrored: {
      const { datasource, identifier, loadError } = action.payload;

      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = newAlertsInfo();
      }

      draft.alerting[datasource][identifier].silences.loaded = true;
      draft.alerting[datasource][identifier].silences.loadError = loadError;
      draft.alerting[datasource][identifier].silences.data = [];
      break;
    }

    case ActionType.AlertingSetSilencesLoaded: {
      const { datasource, identifier, silences } = action.payload;

      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = newAlertsInfo();
      }
      draft.alerting[datasource][identifier].silences = {
        data: silences,
        loaded: true,
        loadError: undefined,
      };
      break;
    }

    case ActionType.AlertingApplySilences: {
      const { datasource, identifier } = action.payload;

      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = {
          alerts: [],
          rules: [],
          alertCount: 0,
          silences: {
            data: [],
            loaded: true,
          },
          loaded: true,
          loadError: null,
        };
      }
      const { alerts, rules, silences } = applySilences({
        alerts: draft.alerting[datasource][identifier].alerts,
        silences: draft.alerting[datasource][identifier].silences.data,
        rules: draft.alerting[datasource][identifier].rules,
      });

      draft.alerting[datasource][identifier].alerts = alerts;
      draft.alerting[datasource][identifier].rules = rules;
      draft.alerting[datasource][identifier].silences.data = silences;

      break;
    }

    case ActionType.AlertingClearSelectorData: {
      const { datasource, identifier } = action.payload;
      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      draft.alerting[datasource][identifier] = newAlertsInfo();
      break;
    }

    case ActionType.ToggleGraphs: {
      draft.hideGraphs = !draft.hideGraphs;
      break;
    }

    case ActionType.ShowGraphs: {
      draft.hideGraphs = false;
      break;
    }

    case ActionType.QueryBrowserAddQuery: {
      draft.queryBrowser.queries.push(newQueryBrowserQuery());
      break;
    }

    case ActionType.QueryBrowserDuplicateQuery: {
      const index = action.payload.index;
      const originQueryText = draft.queryBrowser.queries[index]?.text;
      const duplicate = { ...newQueryBrowserQuery(), text: originQueryText, isEnabled: false };
      draft.queryBrowser.queries.push(duplicate);
      break;
    }

    case ActionType.QueryBrowserDeleteAllQueries: {
      draft.queryBrowser.queries = [newQueryBrowserQuery()];
      break;
    }

    case ActionType.QueryBrowserDeleteAllSeries: {
      draft.queryBrowser.queries = draft.queryBrowser.queries.map((query) => {
        query.series = [];
        return query;
      });
      break;
    }

    case ActionType.QueryBrowserDeleteQuery: {
      const queries = [
        ...draft.queryBrowser.queries.slice(0, action.payload.index),
        ...draft.queryBrowser.queries.slice(action.payload.index + 1),
      ];
      if (queries.length === 0) {
        queries.push(newQueryBrowserQuery());
      }
      draft.queryBrowser.queries = queries;
      break;
    }

    case ActionType.QueryBrowserDismissNamespaceAlert: {
      draft.queryBrowser.dismissNamespaceAlert = true;
      break;
    }

    case ActionType.QueryBrowserPatchQuery: {
      const { index, patch } = action.payload;
      draft.queryBrowser.queries[index] = queryBrowserPatchQueryHelper(index, patch);
      break;
    }

    case ActionType.QueryBrowserRunQueries: {
      const queries = draft.queryBrowser.queries.map((query) => {
        const text = _.trim(query.text);
        return query.isEnabled && query.query !== text
          ? { ...query, query: text, series: [] }
          : query;
      });

      draft.queryBrowser.queries = queries;
      draft.queryBrowser.lastRequestTime = Date.now();
      break;
    }

    case ActionType.QueryBrowserSetAllExpanded: {
      const queries = draft.queryBrowser.queries.map((query) => {
        query.isExpanded = action.payload.isExpanded;
        return query;
      });
      draft.queryBrowser.queries = queries;
      break;
    }

    case ActionType.QueryBrowserSetPollInterval: {
      draft.queryBrowser.pollInterval = String(action.payload.pollInterval);
      break;
    }

    case ActionType.QueryBrowserSetTimespan: {
      draft.queryBrowser.timespan = action.payload.timespan;
      break;
    }

    case ActionType.QueryBrowserToggleAllSeries: {
      const { index } = action.payload;

      const query = draft.queryBrowser.queries[index];
      if (!query) {
        // If the query doesn't exist, then don't toggle all of its series
        break;
      }
      const isDisabledSeriesEmpty = _.isEmpty(draft.queryBrowser.queries[index].disabledSeries);
      const series = draft.queryBrowser.queries[index].series;
      const patch = { disabledSeries: isDisabledSeriesEmpty ? series : [] };
      draft.queryBrowser.queries[index] = queryBrowserPatchQueryHelper(index, patch);
      break;
    }

    case ActionType.QueryBrowserToggleIsEnabled: {
      const query = draft.queryBrowser.queries[action.payload.index];

      if (!query) {
        // If the query doesn't exist, then don't set it to enabled
        break;
      }
      const isEnabled = !query.isEnabled;
      draft.queryBrowser.queries[action.payload.index] = queryBrowserPatchQueryHelper(
        action.payload.index,
        {
          id: query.id,
          isEnabled,
          isExpanded: isEnabled,
          query: isEnabled ? query.text : '',
        },
      );
      break;
    }

    case ActionType.QueryBrowserToggleSeries: {
      const { index, labels } = action.payload;
      if (draft.queryBrowser.queries[index]) {
        draft.queryBrowser.queries[index].disabledSeries = _.xorWith(
          draft.queryBrowser.queries[index].disabledSeries,
          [labels],
          _.isEqual,
        );
      }
      break;
    }

    case ActionType.SetAlertCount: {
      const { datasource, identifier, alertCount } = action.payload;
      if (!draft.alerting[datasource]) {
        draft.alerting[datasource] = {};
      }
      if (!draft.alerting[datasource][identifier]) {
        draft.alerting[datasource][identifier] = newAlertsInfo();
      }

      draft.alerting[datasource][identifier].alertCount = alertCount;
      break;
    }

    case ActionType.SetIncidents: {
      draft.incidentsData.incidents = action.payload.incidents;
      break;
    }

    case ActionType.SetIncidentsActiveFilters: {
      draft.incidentsData.incidentsActiveFilters = action.payload.incidentsActiveFilters;
      break;
    }

    case ActionType.SetAlertsData: {
      draft.incidentsData.alertsData = action.payload.alertsData;
      break;
    }

    case ActionType.SetAlertsTableData: {
      draft.incidentsData.alertsTableData = action.payload.alertsTableData;
      break;
    }

    case ActionType.SetAlertsAreLoading: {
      draft.incidentsData.alertsAreLoading = action.payload.alertsAreLoading;
      break;
    }

    case ActionType.SetIncidentsChartSelection: {
      draft.incidentsData.incidentsChartSelectedId = action.payload.incidentsChartSelectedId;
      break;
    }

    case ActionType.SetFilteredIncidentsData: {
      draft.incidentsData.filteredIncidentsData = action.payload.filteredIncidentsData;
      break;
    }

    case ActionType.SetIncidentsTimestamps: {
      draft.incidentsData.incidentsTimestamps = action.payload.incidentsTimestamps;
      break;
    }

    case ActionType.SetIncidentPageFilterType: {
      draft.incidentsData.incidentPageFilterType = action.payload.incidentPageFilterType;
      break;
    }

    case ActionType.SetIncidentsLastRefreshTime: {
      draft.incidentsData.incidentsLastRefreshTime = action.payload.timestamp;
      break;
    }

    default:
      break;
  }

  return draft;
});

export default monitoringReducer;
