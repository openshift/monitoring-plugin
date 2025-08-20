import * as _ from 'lodash-es';
import { List, Map } from 'immutable';
import {
  Alert,
  AlertStates,
  RuleStates,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { ActionType, ObserveAction } from './actions';

import { isSilenced } from '../components/utils';
import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from '../components/dashboards/legacy/utils';
import { defaultObserveState, newQueryBrowserQuery, ObserveState } from './store';

export default (state: ObserveState, action: ObserveAction): ObserveState => {
  if (!state) {
    return defaultObserveState;
  }

  const queryBrowserPatchQueryHelper = (index: number, patch: { [key: string]: unknown }) => {
    const query = state.hasIn(['queryBrowser', 'queries', index])
      ? Map(patch)
      : Map(newQueryBrowserQuery()).merge(patch);
    return state.mergeIn(['queryBrowser', 'queries', index], query);
  };

  switch (action.type) {
    case ActionType.DashboardsPatchVariable:
      return state.mergeIn(
        ['dashboards', action.payload.perspective, 'variables', action.payload.key],
        Map(action.payload.patch),
      );

    case ActionType.DashboardsPatchAllVariables:
      return state.setIn(
        ['dashboards', action.payload.perspective, 'variables'],
        Map(action.payload.variables),
      );

    case ActionType.DashboardsClearVariables:
      return state.setIn(['dashboards', action.payload.perspective, 'variables'], Map());

    case ActionType.DashboardsSetEndTime:
      return state.setIn(
        ['dashboards', action.payload.perspective, 'endTime'],
        action.payload.endTime,
      );

    case ActionType.DashboardsSetPollInterval:
      return state.setIn(
        ['dashboards', action.payload.perspective, 'pollInterval'],
        action.payload.pollInterval,
      );

    case ActionType.DashboardsSetTimespan:
      return state.setIn(
        ['dashboards', action.payload.perspective, 'timespan'],
        action.payload.timespan,
      );

    case ActionType.DashboardsVariableOptionsLoaded: {
      const { key, newOptions, perspective } = action.payload;
      const { options = [], value } = state
        .get('dashboards')
        .get(perspective)
        .get('variables')
        .get(key);
      const patch = _.isEqual(options, newOptions)
        ? { isLoading: false }
        : {
            isLoading: false,
            options: newOptions,
            value:
              value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY || newOptions.includes(value)
                ? value
                : newOptions[0],
          };
      return state.mergeIn(['dashboards', perspective, 'variables', key], Map(patch));
    }

    case ActionType.AlertingSetRulesLoaded: {
      const { namespace, rules, alerts } = action.payload;
      return state
        .setIn(['alerting', namespace, 'rules'], rules)
        .setIn(['alerting', namespace, 'alerts'], alerts)
        .setIn(['alerting', namespace, 'loaded'], true);
    }

    case ActionType.AlertingSetSilencesLoaded: {
      const { namespace, silences } = action.payload;
      return state
        .setIn(['alerting', namespace, 'silences', 'data'], silences)
        .setIn(['alerting', namespace, 'silences', 'loaded'], true);
    }

    case ActionType.AlertingApplySilences: {
      const { namespace } = action.payload;
      const alerts = state.get('alerting')?.get(namespace)?.get('alerts');
      const silences = state.get('alerting')?.get(namespace)?.get('silences')?.toJS();

      const firingAlerts = alerts.filter(isAlertFiring);

      const updatedAlerts = silenceFiringAlerts(firingAlerts, silences.data);

      return state.setIn(['alerting', namespace, 'alerts'], updatedAlerts);
    }

    case ActionType.ToggleGraphs:
      return state.set('hideGraphs', !state.get('hideGraphs'));

    case ActionType.ShowGraphs:
      return state.set('hideGraphs', false);

    case ActionType.QueryBrowserAddQuery:
      return state.setIn(
        ['queryBrowser', 'queries'],
        state.getIn(['queryBrowser', 'queries']).push(newQueryBrowserQuery()),
      );

    case ActionType.QueryBrowserDuplicateQuery: {
      const index = action.payload.index;
      const originQueryText = state.getIn(['queryBrowser', 'queries', index, 'text']);
      const duplicate = newQueryBrowserQuery().merge({
        text: originQueryText,
        isEnabled: false,
      });
      return state.setIn(
        ['queryBrowser', 'queries'],
        state.getIn(['queryBrowser', 'queries']).concat(duplicate),
      );
    }

    case ActionType.QueryBrowserDeleteAllQueries:
      return state.setIn(['queryBrowser', 'queries'], List([newQueryBrowserQuery()]));

    case ActionType.QueryBrowserDeleteAllSeries: {
      return state.setIn(
        ['queryBrowser', 'queries'],
        state.getIn(['queryBrowser', 'queries']).map((q) => Map(q).set('series', undefined)),
      );
    }

    case ActionType.QueryBrowserDeleteQuery: {
      let queries = List(state.getIn(['queryBrowser', 'queries'])).delete(action.payload.index);
      if (queries.size === 0) {
        queries = queries.push(newQueryBrowserQuery());
      }
      return state.setIn(['queryBrowser', 'queries'], queries);
    }

    case ActionType.QueryBrowserDismissNamespaceAlert:
      return state.setIn(['queryBrowser', 'dismissNamespaceAlert'], true);

    case ActionType.QueryBrowserPatchQuery: {
      const { index, patch } = action.payload;
      return queryBrowserPatchQueryHelper(index, patch);
    }

    case ActionType.QueryBrowserRunQueries: {
      const queries = state.getIn(['queryBrowser', 'queries']).map((q) => {
        const text = _.trim(q.get('text'));
        return q.get('isEnabled') && q.get('query') !== text
          ? q.merge({ query: text, series: undefined })
          : q;
      });

      return state
        .setIn(['queryBrowser', 'queries'], queries)
        .setIn(['queryBrowser', 'lastRequestTime'], Date.now());
    }

    case ActionType.QueryBrowserSetAllExpanded: {
      const queries = state.getIn(['queryBrowser', 'queries']).map((q) => {
        return Map(q).set('isExpanded', action.payload.isExpanded);
      });
      return state.setIn(['queryBrowser', 'queries'], queries);
    }

    case ActionType.QueryBrowserSetMetrics:
      return state.setIn(['queryBrowser', 'metrics'], action.payload.metrics);

    case ActionType.QueryBrowserSetPollInterval:
      return state.setIn(['queryBrowser', 'pollInterval'], action.payload.pollInterval);

    case ActionType.QueryBrowserSetTimespan:
      return state.setIn(['queryBrowser', 'timespan'], action.payload.timespan);

    case ActionType.QueryBrowserToggleAllSeries: {
      const index = action.payload.index;
      const isDisabledSeriesEmpty = _.isEmpty(
        state.getIn(['queryBrowser', 'queries', index, 'disabledSeries']),
      );
      const series = state.getIn(['queryBrowser', 'queries', index, 'series']);
      const patch = { disabledSeries: isDisabledSeriesEmpty ? series : [] };
      return queryBrowserPatchQueryHelper(index, patch);
    }

    case ActionType.QueryBrowserToggleIsEnabled: {
      const query = Map(state.getIn(['queryBrowser', 'queries', action.payload.index]));
      const isEnabled = !query.get('isEnabled');
      return state.setIn(
        ['queryBrowser', 'queries', action.payload.index],
        query.merge({
          isEnabled,
          isExpanded: isEnabled,
          query: isEnabled ? query.get('text') : '',
        }),
      );
    }

    case ActionType.QueryBrowserToggleSeries:
      return state.updateIn(
        ['queryBrowser', 'queries', action.payload.index, 'disabledSeries'],
        (v: Array<any>) => _.xorWith(v, [action.payload.labels], _.isEqual),
      );

    case ActionType.SetAlertCount:
      return state.setIn([action.payload.namespace, 'alertCount'], action.payload.alertCount);

    case ActionType.SetIncidents: {
      return state.setIn(['incidentsData', 'incidents'], action.payload.incidents);
    }

    case ActionType.SetIncidentsActiveFilters: {
      return state.setIn(
        ['incidentsData', 'incidentsActiveFilters'],
        action.payload.incidentsActiveFilters,
      );
    }

    case ActionType.SetChooseIncident: {
      return state.setIn(['incidentsData', 'groupId'], action.payload.groupId);
    }

    case ActionType.SetAlertsData: {
      return state.setIn(['incidentsData', 'alertsData'], action.payload.alertsData);
    }

    case ActionType.SetAlertsTableData: {
      return state.setIn(['incidentsData', 'alertsTableData'], action.payload.alertsTableData);
    }

    case ActionType.SetAlertsAreLoading: {
      return state.setIn(['incidentsData', 'alertsAreLoading'], action.payload.alertsAreLoading);
    }

    case ActionType.SetIncidentsChartSelection: {
      return state.setIn(
        ['incidentsData', 'incidentsChartSelectedId'],
        action.payload.incidentsChartSelectedId,
      );
    }

    case ActionType.SetFilteredIncidentsData: {
      return state.setIn(
        ['incidentsData', 'filteredIncidentsData'],
        action.payload.filteredIncidentsData,
      );
    }

    default:
      break;
  }
  return state;
};

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
