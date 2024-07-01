import * as React from 'react';
import { PrometheusEndpoint, PrometheusRulesResponse } from '@openshift-console/dynamic-plugin-sdk';
import { Dispatch } from 'redux';
import { getPrometheusURL } from '../console/graphs/helpers';
import {
  alertingErrored,
  alertingLoaded,
  alertingLoading,
  alertingSetRules,
} from '../../actions/observe';
import { fetchAlerts } from '../fetch-alerts';
import { getAlertsAndRules } from '../utils';
import * as _ from 'lodash-es';
import { usePerspective } from './usePerspective';

const pollerTimeouts = {};
const pollers = {};

export const useRulesAlertsPoller = (
  namespace: string,
  dispatch: Dispatch,
  alertsSource: {
    id: string;
    getAlertingRules: (namespace?: string) => Promise<PrometheusRulesResponse>;
  }[],
) => {
  const { perspective, rulesKey, alertsKey, isDev } = usePerspective();
  React.useEffect(() => {
    const { prometheusBaseURL } = window.SERVER_FLAGS;

    if (prometheusBaseURL) {
      dispatch(alertingLoading(alertsKey, perspective));
      const url = getPrometheusURL({
        endpoint: PrometheusEndpoint.RULES,
        namespace: isDev ? namespace : '',
      });
      const poller = (): void => {
        fetchAlerts(url, alertsSource, namespace)
          .then(({ data }) => {
            const { alerts, rules } = getAlertsAndRules(data, isDev);
            dispatch(alertingLoaded(alertsKey, alerts, perspective));
            dispatch(alertingSetRules(rulesKey, rules, perspective));
          })
          .catch((e) => {
            dispatch(alertingErrored(alertsKey, e, perspective));
          })
          .then(() => {
            if (pollerTimeouts[alertsKey]) {
              clearTimeout(pollerTimeouts[alertsKey]);
            }
            pollerTimeouts[alertsKey] = setTimeout(poller, 15 * 1000);
          });
      };
      pollers[alertsKey] = poller;
      poller();
    } else {
      dispatch(alertingErrored('alerts', new Error('prometheusBaseURL not set'), perspective));
    }
    return (): void => {
      _.each(pollerTimeouts, clearTimeout);
    };
  }, [alertsSource, dispatch, perspective, rulesKey, alertsKey, namespace, isDev]);
};
