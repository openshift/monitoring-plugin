import * as _ from 'lodash-es';
import {
  Alert,
  AlertStates,
  RuleStates,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { ActionType, ObserveAction } from './actions';

import { isSilenced } from '../components/utils';
import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from '../components/dashboards/legacy/utils';
import { defaultObserveState, newQueryBrowserQuery, ObserveState, QueryStructure } from './store';
import { produce } from 'immer';

const monitoringReducer = produce((draft: ObserveState, action: ObserveAction): ObserveState => {
  if (!draft) {
    return defaultObserveState;
  }

  const queryBrowserPatchQueryHelper = (index: number, patch: QueryStructure): QueryStructure => {
    return draft.queryBrowser.queries[index] ? patch : { ...newQueryBrowserQuery(), ...patch };
  };

  switch (action.type) {
    case ActionType.DashboardsPatchVariable: {
      draft.dashboards[action.payload.perspective].variables[action.payload.key] =
        action.payload.patch;
      break;
    }

    case ActionType.DashboardsPatchAllVariables: {
      draft.dashboards[action.payload.perspective].variables = action.payload.variables;
      break;
    }

    case ActionType.DashboardsClearVariables: {
      draft.dashboards[action.payload.perspective].variables = {};
      break;
    }

    case ActionType.DashboardsSetEndTime: {
      draft.dashboards[action.payload.perspective].endTime = String(action.payload.endTime);
      break;
    }

    case ActionType.DashboardsSetPollInterval: {
      draft.dashboards[action.payload.perspective].pollInterval = action.payload.pollInterval;
      break;
    }

    case ActionType.DashboardsSetTimespan: {
      draft.dashboards[action.payload.perspective].timespan = action.payload.timespan;
      break;
    }

    case ActionType.DashboardsVariableOptionsLoaded: {
      const { key, newOptions, perspective } = action.payload;
      const val = draft.dashboards[perspective].variables[key];
      const patch = _.isEqual(val?.options, newOptions)
        ? { isLoading: false }
        : {
            isLoading: false,
            options: newOptions,
            value:
              val?.value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ||
              newOptions.includes(val?.value)
                ? val?.value
                : newOptions[0],
          };
      draft.dashboards[perspective].variables[key] = patch;
      break;
    }

    case ActionType.AlertingSetRulesLoaded: {
      const { datasource, identifier, rules, alerts } = action.payload;
      const datasourceObj = draft.alerting[datasource];
      if (!datasourceObj) {
        draft.alerting[datasource] = {};
      }
      draft.alerting[datasource][identifier] = {
        rules,
        alerts,
        loaded: true,
        loadError: null,
        alertCount: alerts.length,
        silences: { data: [], loaded: false },
      };
      break;
    }

    case ActionType.AlertingSetSilencesLoaded: {
      const { datasource, identifier, silences } = action.payload;
      draft.alerting[datasource][identifier].silences = {
        data: silences,
        loaded: true,
        loadError: null,
      };
      break;
    }

    case ActionType.AlertingApplySilences: {
      const { datasource, identifier } = action.payload;
      const alerts = draft.alerting[datasource][identifier]?.alerts;
      const silences = draft.alerting[datasource][identifier]?.silences;

      const firingAlerts = alerts.filter(isAlertFiring);

      const updatedAlerts = silenceFiringAlerts(firingAlerts, silences.data);
      draft.alerting[datasource][identifier].alerts = updatedAlerts;
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
      const originQueryText = draft.queryBrowser.queries[index].text;
      const duplicate = { ...newQueryBrowserQuery(), text: originQueryText, isEnabled: false };
      draft.queryBrowser.queries.push(duplicate);
      break;
    }

    case ActionType.QueryBrowserDeleteAllQueries: {
      draft.queryBrowser.queries = [newQueryBrowserQuery()];
      break;
    }

    case ActionType.QueryBrowserDeleteAllSeries: {
      draft.queryBrowser.queries = draft.queryBrowser.queries.map(
        (query) => (query.series = undefined),
      );
      break;
    }

    case ActionType.QueryBrowserDeleteQuery: {
      const queries = [
        ...draft.queryBrowser.queries.slice(0, action.payload.index),
        ...draft.queryBrowser.queries.slice(action.payload.index),
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      draft.queryBrowser.queries[index] = queryBrowserPatchQueryHelper(index, patch);
      break;
    }

    case ActionType.QueryBrowserRunQueries: {
      const queries = draft.queryBrowser.queries.map((query) => {
        const text = _.trim(query.text);
        return query.isEnabled && query.query !== text
          ? { ...query, query: text, series: undefined }
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

    case ActionType.QueryBrowserSetMetrics: {
      draft.queryBrowser.metrics = action.payload.metrics;
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
      const index = action.payload.index;
      const isDisabledSeriesEmpty = _.isEmpty(draft.queryBrowser.queries[index].disabledSeries);
      const series = draft.queryBrowser.queries[index].series;
      const patch = { disabledSeries: isDisabledSeriesEmpty ? series : [] };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      draft.queryBrowser.queries[index] = queryBrowserPatchQueryHelper(index, patch);
      break;
    }

    case ActionType.QueryBrowserToggleIsEnabled: {
      const query = draft.queryBrowser.queries[action.payload.index];
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

    // This one is prob wrong
    case ActionType.QueryBrowserToggleSeries: {
      draft.queryBrowser.queries[action.payload.index].disabledSeries = draft.queryBrowser.queries[
        action.payload.index
      ].disabledSeries.filter((series) => {
        return _.isEqual(series, action.payload.labels);
      });
      break;
    }

    case ActionType.SetAlertCount: {
      draft.alerting[action.payload.datasource][action.payload.identifier].alertCount =
        action.payload.alertCount;
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

    case ActionType.SetChooseIncident: {
      draft.incidentsData.groupId = action.payload.groupId;
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

    default:
      break;
  }
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

const silenceFiringAlerts = (firingAlerts: Array<Alert>, silences): Array<Alert> => {
  // For each firing alert, store a list of the Silences that are silencing it
  // and set its state to show it is silenced
  _.each(firingAlerts, (a) => {
    a.silencedBy = _.filter(
      silences,
      (s) => _.get(s, 'status.state') === SilenceStates.Active && isSilenced(a, s),
    );
    if (a.silencedBy.length) {
      a.state = AlertStates.Silenced;
      // Also set the state of Alerts in `rule.alerts`
      _.each(a.rule.alerts, (ruleAlert) => {
        if (_.some(a.silencedBy, (s) => isSilenced(ruleAlert, s))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });
      if (!_.isEmpty(a.rule.alerts) && _.every(a.rule.alerts, isSilenced)) {
        a.rule.state = RuleStates.Silenced;
        a.rule.silencedBy = _.filter(
          silences,
          (s) => s.status.state === SilenceStates.Active && _.some(a.rule.alerts, isSilenced),
        );
      }
    }
  });
  return firingAlerts;
};

export default monitoringReducer;
