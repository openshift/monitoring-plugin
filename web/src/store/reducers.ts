import * as _ from 'lodash-es';
import {
  Alert,
  AlertStates,
  RuleStates,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { ActionType, ObserveAction } from './actions';

import { isSilenced } from '../components/utils';
import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from '../components/dashboards/legacy/utils';
import {
  defaultObserveState,
  newAlertsInfo,
  newQueryBrowserQuery,
  ObserveState,
  QueryStructure,
} from './store';
import { produce } from 'immer';

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

      const alerts = draft.alerting[datasource][identifier].alerts;
      const silences = draft.alerting[datasource][identifier].silences;

      const firingAlerts = alerts.filter(isAlertFiring);

      const updatedAlerts = silenceFiringAlerts(firingAlerts, silences.data);
      draft.alerting[datasource][identifier].alerts = updatedAlerts;

      silences.data = silences.data.map((silence) => {
        silence.firingAlerts = firingAlerts.filter((firingAlert) =>
          isSilenced(firingAlert, silence),
        );
        return silence;
      });

      draft.alerting[datasource][identifier].silences = silences;
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

    case ActionType.SetIncidentPageFilterType: {
      draft.incidentsData.incidentPageFilterType = action.payload.incidentPageFilterType;
      break;
    }

    default:
      break;
  }

  return draft;
});

export type NotificationAlerts = {
  data: Alert[];
  loaded: boolean;
  loadError?: {
    message?: string;
  };
};

const isAlertFiring = (alert: Alert) =>
  alert?.state === AlertStates.Firing || alert?.state === AlertStates.Silenced;

const silenceFiringAlerts = (
  firingAlerts: Array<Alert>,
  silences: Array<Silence>,
): Array<Alert> => {
  // For each firing alert, store a list of the Silences that are silencing it
  // and set its state to show it is silenced
  firingAlerts.forEach((firingAlert) => {
    firingAlert.silencedBy = silences.filter(
      (silence) =>
        silence.status?.state === SilenceStates.Active && isSilenced(firingAlert, silence),
    );

    if (firingAlert.silencedBy.length) {
      firingAlert.state = AlertStates.Silenced;
      // Also set the state of Alerts in `rule.alerts`

      firingAlert.rule.alerts.forEach((ruleAlert) => {
        if (firingAlert.silencedBy?.some((silence) => isSilenced(ruleAlert, silence))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });

      if (
        firingAlert.rule.alerts.length !== 0 &&
        firingAlert.rule.alerts.every((alert) => alert.state === AlertStates.Silenced)
      ) {
        firingAlert.rule.state = RuleStates.Silenced;

        firingAlert.rule.silencedBy = silences.filter(
          (silence) =>
            silence.status?.state === SilenceStates.Active &&
            firingAlert.rule.alerts.some((alert) => isSilenced(alert, silence)),
        );
      }
    }
  });
  return firingAlerts;
};

export default monitoringReducer;
