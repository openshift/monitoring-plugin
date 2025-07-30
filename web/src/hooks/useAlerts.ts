import { useContext, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { fetchAlertingData } from '../store/thunks';
import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  PrometheusEndpoint,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import { MonitoringContext } from '../contexts/MonitoringContext';
import {
  buildPrometheusUrl,
  getAlertingContextId,
  getAlertmanagerSilencesUrl,
  getPrometheusBasePath,
} from '../components/utils';
import { usePoll } from '../components/console/utils/poll-hook';

const POLLING_INTERVAL_MS = 15 * 1000; // 15 seconds

export const useAlerts = () => {
  const dispatch = useDispatch();
  const { prometheus } = useContext(MonitoringContext);
  const [namespace] = useActiveNamespace();
  const [customExtensions] =
    useResolvedExtensions<AlertingRulesSourceExtension>(isAlertingRulesSource);

  const alertsSource = useMemo(
    () =>
      customExtensions
        .filter(
          (extension) =>
            extension.properties.contextId === getAlertingContextId({ prometheus, namespace }),
        )
        .map((extension) => extension.properties),
    [customExtensions, prometheus, namespace],
  );

  const rulesUrl = buildPrometheusUrl({
    prometheusUrlProps: { endpoint: PrometheusEndpoint.RULES, namespace },
    basePath: getPrometheusBasePath({ prometheus }),
  });
  const silencesUrl = getAlertmanagerSilencesUrl({ prometheus, namespace });

  const fetchDispatch = () =>
    dispatch(fetchAlertingData(namespace, rulesUrl, alertsSource, silencesUrl));

  usePoll(fetchDispatch, POLLING_INTERVAL_MS);

  return {
    trigger: fetchDispatch,
  };
};
