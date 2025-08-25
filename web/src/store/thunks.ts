import { consoleFetchJSON, Silence } from '@openshift-console/dynamic-plugin-sdk';
import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import {
  alertingSetLoading,
  alertingSetRulesLoaded,
  alertingSetSilencesLoaded,
  alertingApplySilences,
  alertingSetSilencesErrored,
  alertingSetErrored,
} from './actions';
import { getAlertsAndRules, getSilenceName, Prometheus } from '../components/utils';
import { fetchAlerts } from '../components/fetch-alerts';

import type { RootState } from './store';

export const fetchAlertingData =
  (
    prometheus: Prometheus,
    namespace: string,
    rulesUrl: string,
    alertsSource: any,
    silencesUrl: string,
  ): ThunkAction<void, RootState, unknown, Action<string>> =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (dispatch, getState) => {
    dispatch(alertingSetLoading(prometheus, namespace));

    const [rulesResponse, silencesResponse] = await Promise.allSettled([
      fetchAlerts(rulesUrl, alertsSource, namespace),
      consoleFetchJSON(silencesUrl, 'get') as Promise<Silence[]>,
    ]);

    if (rulesResponse.status === 'rejected') {
      dispatch(alertingSetErrored(prometheus, namespace, rulesResponse.reason));
    } else {
      const { alerts, rules } = getAlertsAndRules(rulesResponse.value.data);
      dispatch(alertingSetRulesLoaded(prometheus, namespace, rules, alerts));
    }

    if (silencesResponse.status === 'rejected') {
      dispatch(alertingSetSilencesErrored(prometheus, namespace, silencesResponse.reason));
    } else {
      const silences = silencesResponse.value.map((silence) => ({
        ...silence,
        name: getSilenceName(silence),
      }));
      dispatch(alertingSetSilencesLoaded(prometheus, namespace, silences));
    }

    dispatch(alertingApplySilences(prometheus, namespace));
  };
