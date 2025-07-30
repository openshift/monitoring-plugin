import * as React from 'react';
import { useDispatch } from 'react-redux';
import { PrometheusEndpoint, PrometheusRulesResponse } from '@openshift-console/dynamic-plugin-sdk';
import { getPrometheusBasePath, buildPrometheusUrl } from '../console/graphs/helpers';
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
  alertsSource: {
    id: string;
    getAlertingRules: (namespace?: string) => Promise<PrometheusRulesResponse>;
  }[],
) => {
  const { perspective, rulesKey, alertsKey } = usePerspective();
  const dispatch = useDispatch();

  React.useEffect(() => {
    dispatch(alertingLoading(alertsKey, perspective));
    const url = buildPrometheusUrl({
      prometheusUrlProps: {
        endpoint: PrometheusEndpoint.RULES,
        namespace,
      },
      basePath: getPrometheusBasePath({ prometheus: 'cmo' }),
    });
    const poller = (): void => {
      fetchAlerts(url, alertsSource, namespace)
        .then(({ data }) => {
          const { alerts, rules } = getAlertsAndRules(data);
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

    return (): void => {
      _.each(pollerTimeouts, clearTimeout);
    };
  }, [alertsSource, dispatch, perspective, rulesKey, alertsKey, namespace]);
};
