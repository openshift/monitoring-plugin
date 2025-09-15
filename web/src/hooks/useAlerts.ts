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
  Prometheus,
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

export const useAlerts = (props?: { overrideNamespace?: string }) => {
  // Retrieve external information which dictates which alerts to load and use
  const { plugin } = useMonitoring();
  const [namespace] = useActiveNamespace();
  const { prometheus } = useMonitoring();
  const { perspective } = usePerspective();
  const overriddenNamespace = props?.overrideNamespace ? props.overrideNamespace : namespace;

  // Start polling for alerts, rules, and silences
  const { trigger } = useAlertsPoller({
    namespace: overriddenNamespace,
    prometheus,
  });

  // Retrieve alerts, rules and silences from the store, which is populated in the poller
  const alerts = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[overriddenNamespace]?.alerts,
  );
  const rulesAlertLoading = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[overriddenNamespace],
  );
  const silences = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[overriddenNamespace]?.silences,
  );
  const rules: Rule[] = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).alerting[prometheus]?.[overriddenNamespace]?.rules,
  );

  // Find all labels needed within our list pages
  const additionalAlertSourceLabels = useMemo(
    () => getAdditionalSources(alerts, alertSource),
    [alerts],
  );
  const additionalRuleSourceLabels = useMemo(
    () => getAdditionalSources(rules, alertingRuleSource),
    [rules],
  );
  const alertClusterLabels = useMemo(() => {
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
  const silenceClusterLabels = useMemo(() => {
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

  // When a user with cluster scoped alerts retrieves alerts from the tenancy API endpoint
  // the API will still retrun ALL alerts, not just the ones which are available at that tenant
  // As such we manually filter down the alerts on the frontend
  const namespacedAlerts = useMemo(() => {
    if (perspective === 'acm' || namespace === ALL_NAMESPACES_KEY) {
      return alerts;
    }
    return alerts?.filter((alert) => alert.labels?.namespace === namespace);
  }, [alerts, perspective, namespace]);

  return {
    trigger,
    additionalAlertSourceLabels,
    additionalRuleSourceLabels,
    alertClusterLabels,
    silenceClusterLabels,
    rulesAlertLoading,
    rules,
    silences,
    alerts: namespacedAlerts,
  };
};

const useAlertsPoller = ({
  namespace,
  prometheus,
}: {
  namespace?: string;
  prometheus: Prometheus;
}) => {
  const dispatch = useDispatch();
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
