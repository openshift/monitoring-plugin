import * as _ from 'lodash-es';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import {
  Alert,
  AlertStates,
  RuleStates,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { ActionType, ObserveAction } from '../actions/observe';

import { isSilenced } from '../components/utils';
import { getAlertsKey, getSilencesKey } from '../components/hooks/usePerspective';
import {
  MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
  MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY,
} from '../components/dashboards/legacy/utils';

export type ObserveState = ImmutableMap<string, any>;

export type MonitoringState = {
  observe: ObserveState;
  plugins: {
    mcp?: ObserveState;
    mp?: ObserveState;
  };
};

const newQueryBrowserQuery = (): ImmutableMap<string, any> =>
  ImmutableMap({
    id: _.uniqueId('query-browser-query'),
    isEnabled: true,
    isExpanded: true,
  });

export const silenceFiringAlerts = (firingAlerts, silences) => {
  // For each firing alert, store a list of the Silences that are silencing it
  // and set its state to show it is silenced
  _.each(firingAlerts, (a) => {
    a.silencedBy = _.filter(
      _.get(silences, 'data'),
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
          silences?.data,
          (s) => s.status.state === SilenceStates.Active && _.some(a.rule.alerts, isSilenced),
        );
      }
    }
  });
};

export default (state: ObserveState, action: ObserveAction): ObserveState => {
  if (!state) {
    return ImmutableMap({
      dashboards: ImmutableMap({
        dev: ImmutableMap({
          endTime: null,
          pollInterval: 30 * 1000,
          timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
          variables: ImmutableMap(),
        }),
        admin: ImmutableMap({
          endTime: null,
          pollInterval: 30 * 1000,
          timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
          variables: ImmutableMap(),
        }),
      }),
      queryBrowser: ImmutableMap({
        metrics: [],
        pollInterval: null,
        queries: ImmutableList([newQueryBrowserQuery()]),
        timespan: MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
      }),
      incidentsData: ImmutableMap({
        incidents: [],
        alertsData: [],
        alertsTableData: [],
        filteredIncidentsData: [],
        alertsAreLoading: true,
        incidentsChartSelectedId: '',
        incidentsInitialState: {
          days: ['7 days'],
          incidentFilters: ['Critical', 'Warning', 'Firing'],
        },
        incidentsActiveFilters: {
          days: [],
          incidentFilters: [],
        },
        groupId: '',
      }),
    });
  }

  const queryBrowserPatchQueryHelper = (index: number, patch: { [key: string]: unknown }) => {
    const query = state.hasIn(['queryBrowser', 'queries', index])
      ? ImmutableMap(patch)
      : newQueryBrowserQuery().merge(patch);
    return state.mergeIn(['queryBrowser', 'queries', index], query);
  };

  switch (action.type) {
    case ActionType.DashboardsPatchVariable:
      return state.mergeIn(
        ['dashboards', action.payload.perspective, 'variables', action.payload.key],
        ImmutableMap(action.payload.patch),
      );

    case ActionType.DashboardsPatchAllVariables:
      return state.setIn(
        ['dashboards', action.payload.perspective, 'variables'],
        ImmutableMap(action.payload.variables),
      );

    case ActionType.DashboardsClearVariables:
      return state.setIn(['dashboards', action.payload.perspective, 'variables'], ImmutableMap());

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
      const { options, value } = state.getIn(['dashboards', perspective, 'variables', key]).toJS();
      const patch = _.isEqual(options, newOptions)
        ? { isLoading: false }
        : {
            isLoading: false,
            options: newOptions,
            value:
              value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY || newOptions.includes(value)
                ? value
                : perspective === 'dev' && key === 'namespace'
                ? state.get('activeNamespace')
                : newOptions[0],
          };
      return state.mergeIn(['dashboards', perspective, 'variables', key], ImmutableMap(patch));
    }

    case ActionType.AlertingSetRules: {
      return state.set(action.payload.key, action.payload.data);
    }

    case ActionType.AlertingSetData: {
      const alertsKey = getAlertsKey(action.payload.data.perspective);
      const alerts = action.payload.key === alertsKey ? action.payload.data : state.get(alertsKey);
      // notificationAlerts used by notification drawer and certain dashboards
      const notificationAlerts: NotificationAlerts =
        action.payload.key === 'notificationAlerts'
          ? action.payload.data
          : state.get('notificationAlerts');

      const silencesKey = getSilencesKey(action.payload.data.perspective);
      const silences =
        action.payload.key === silencesKey ? action.payload.data : state.get(silencesKey);

      const isAlertFiring = (alert) =>
        alert?.state === AlertStates.Firing || alert?.state === AlertStates.Silenced;
      const firingAlerts = _.filter(alerts?.data, isAlertFiring);
      silenceFiringAlerts(firingAlerts, silences);
      silenceFiringAlerts(_.filter(notificationAlerts?.data, isAlertFiring), silences);
      if (notificationAlerts?.data) {
        notificationAlerts.data = _.reject(notificationAlerts?.data, {
          state: AlertStates.Silenced,
        });
      }
      state = state.set(alertsKey, alerts);
      state = state.set('notificationAlerts', notificationAlerts);

      // For each Silence, store a list of the Alerts it is silencing
      _.each(_.get(silences, 'data'), (s) => {
        s.firingAlerts = _.filter(firingAlerts, (a) => isSilenced(a, s));
      });
      return state.set(silencesKey, silences);
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
        state.getIn(['queryBrowser', 'queries']).push(duplicate),
      );
    }

    case ActionType.QueryBrowserDeleteAllQueries:
      return state.setIn(['queryBrowser', 'queries'], ImmutableList([newQueryBrowserQuery()]));

    case ActionType.QueryBrowserDeleteAllSeries: {
      return state.setIn(
        ['queryBrowser', 'queries'],
        state.getIn(['queryBrowser', 'queries']).map((q) => q.set('series', undefined)),
      );
    }

    case ActionType.QueryBrowserDeleteQuery: {
      let queries = state.getIn(['queryBrowser', 'queries']).delete(action.payload.index);
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
        const isEnabled = q.get('isEnabled');
        const query = q.get('query');
        const text = _.trim(q.get('text'));
        return isEnabled && query !== text ? q.merge({ query: text, series: undefined }) : q;
      });

      return state
        .setIn(['queryBrowser', 'queries'], queries)
        .setIn(['queryBrowser', 'lastRequestTime'], Date.now());
    }

    case ActionType.QueryBrowserSetAllExpanded: {
      const queries = state.getIn(['queryBrowser', 'queries']).map((q) => {
        return q.set('isExpanded', action.payload.isExpanded);
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
      const query = state.getIn(['queryBrowser', 'queries', action.payload.index]);
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
        (v) => _.xorWith(v, [action.payload.labels], _.isEqual),
      );

    case ActionType.SetAlertCount:
      return state.set('alertCount', action.payload.alertCount);

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
