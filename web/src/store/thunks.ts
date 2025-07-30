import { Silence } from '@openshift-console/dynamic-plugin-sdk';
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
import { getAlertsAndRules, getSilenceName } from '../components/utils';
import { fetchAlerts } from '../components/fetch-alerts';
import { useSafeFetch } from '../components/console/utils/safe-fetch-hook';

import type { RootState } from './store';

export const fetchAlertingData =
  (
    namespace: string,
    rulesUrl: string,
    alertsSource: any,
    silencesUrl: string,
  ): ThunkAction<void, RootState, unknown, Action<string>> =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (dispatch, getState) => {
    const safeFetch = useSafeFetch();
    dispatch(alertingSetLoading(namespace));

    const [rulesResponse, silencesResponse] = await Promise.allSettled([
      fetchAlerts(rulesUrl, alertsSource, namespace),
      safeFetch<Silence[]>(silencesUrl),
    ]);

    if (rulesResponse.status === 'rejected') {
      dispatch(alertingSetErrored(namespace, rulesResponse.reason));
    } else {
      const { alerts, rules } = getAlertsAndRules(rulesResponse.value.data);
      dispatch(alertingSetRulesLoaded(namespace, rules, alerts));
    }

    if (silencesResponse.status === 'rejected') {
      dispatch(alertingSetSilencesErrored(namespace, silencesResponse.reason));
    } else {
      const silences = silencesResponse.value.map((silence) => ({
        ...silence,
        name: getSilenceName(silence),
      }));
      dispatch(alertingSetSilencesLoaded(namespace, silences));
    }

    dispatch(alertingApplySilences(namespace));
  };
