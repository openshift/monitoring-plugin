import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlertingData } from '../store/thunks';
import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  PrometheusEndpoint,
  Rule,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ALL_NAMESPACES_KEY,
  buildPrometheusUrl,
  getAlertingContextId,
  getAlertmanagerSilencesUrl,
  getPrometheusBasePath,
  silenceCluster,
} from '../components/utils';
import { usePoll } from '../components/console/utils/poll-hook';
import { useMonitoring } from './useMonitoring';
import {
  alertingRuleSource,
  alertSource,
  getAdditionalSources,
} from '../components/alerting/AlertUtils';
import { MonitoringState } from '../store/store';
import { getObserveState, usePerspective } from '../components/hooks/usePerspective';

const POLLING_INTERVAL_MS = 15 * 1000; // 15 seconds

export const useAlerts = () => {
  const { plugin } = useMonitoring();
  const [namespace] = useActiveNamespace();
  const { prometheus } = useMonitoring();
  const { perspective } = usePerspective();

  const alerts = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[namespace]?.alerts,
  );
  const rulesAlertLoading = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).alerting[prometheus]?.[namespace],
  );
  const silences = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[namespace]?.silences,
  );
  const rules: Rule[] = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[namespace]?.rules,
  );

  const { trigger } = useAlertsPoller();

  const additionalAlertSources = useMemo(() => getAdditionalSources(alerts, alertSource), [alerts]);
  const additionalRuleSources = useMemo(
    () => getAdditionalSources(rules, alertingRuleSource),
    [rules],
  );

  const alertClusters = useMemo(() => {
    const clusterSet = new Set<string>();
    alerts?.forEach((alert) => {
      const clusterName = alert.labels?.cluster;
      if (clusterName) {
        clusterSet.add(clusterName);
      }
    });

    const clusterArray = Array.from(clusterSet);
    return clusterArray.sort();
  }, [alerts]);

  const silenceClusters = useMemo(() => {
    const clusterSet = new Set<string>();
    silences?.data?.forEach((silence) => {
      const clusterName = silenceCluster(silence);
      if (clusterName) {
        clusterSet.add(clusterName);
      }
    });

    const clusterArray = Array.from(clusterSet);
    return clusterArray.sort();
  }, [silences]);

  const namespacedAlerts = useMemo(() => {
    if (perspective === 'acm' || namespace === ALL_NAMESPACES_KEY) {
      return alerts;
    }
    return alerts?.filter((alert) => alert.labels?.namespace === namespace);
  }, [alerts, perspective, namespace]);

  return {
    trigger,
    additionalAlertSources,
    additionalRuleSources,
    alertClusters,
    silenceClusters,
    rulesAlertLoading,
    alerts,
    rules,
    silences,
    namespacedAlerts,
  };
};

const useAlertsPoller = () => {
  const dispatch = useDispatch();
  const { prometheus } = useMonitoring();
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
    basePath: getPrometheusBasePath({ prometheus, namespace }),
  });
  const silencesUrl = getAlertmanagerSilencesUrl({ prometheus, namespace });

  const fetchDispatch = () =>
    dispatch(fetchAlertingData(prometheus, namespace, rulesUrl, alertsSource, silencesUrl));

  usePoll(fetchDispatch, POLLING_INTERVAL_MS);

  return { trigger: fetchDispatch };
};
