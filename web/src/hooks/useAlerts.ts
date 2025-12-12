import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlertingData } from '../store/thunks';
import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  PrometheusEndpoint,
  Rule,
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
import { getObserveState } from '../components/hooks/usePerspective';
import { useQueryNamespace } from '../components/hooks/useQueryNamespace';

const POLLING_INTERVAL_MS = 15 * 1000; // 15 seconds

export const useAlerts = (props?: { dontUseTenancy?: boolean }) => {
  // Retrieve external information which dictates which alerts to load and use
  const { plugin } = useMonitoring();
  const { namespace } = useQueryNamespace();
  const { prometheus, useAlertsTenancy, accessCheckLoading } = useMonitoring();
  const overriddenNamespace =
    props?.dontUseTenancy || !useAlertsTenancy ? ALL_NAMESPACES_KEY : namespace;

  // Start polling for alerts, rules, and silences
  const { trigger } = useAlertsPoller({
    namespace: overriddenNamespace,
    prometheus,
    useAlertsTenancy,
    accessCheckLoading,
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

  return {
    trigger,
    additionalAlertSourceLabels,
    additionalRuleSourceLabels,
    alertClusterLabels,
    silenceClusterLabels,
    rulesAlertLoading,
    rules,
    silences,
    alerts,
  };
};

const useAlertsPoller = ({
  namespace,
  prometheus,
  useAlertsTenancy,
  accessCheckLoading,
}: {
  namespace?: string;
  prometheus: Prometheus;
  useAlertsTenancy: boolean;
  accessCheckLoading: boolean;
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
    basePath: getPrometheusBasePath({ prometheus, useTenancyPath: useAlertsTenancy }),
  });
  const silencesUrl = getAlertmanagerSilencesUrl({
    prometheus,
    namespace,
    useTenancyPath: useAlertsTenancy,
  });

  const fetchDispatch = () =>
    dispatch(
      fetchAlertingData(
        prometheus,
        namespace,
        rulesUrl,
        alertsSource,
        silencesUrl,
        !accessCheckLoading, // Wait to poll until we know which endpoint to use
      ),
    );

  const dependencies = useMemo(
    () => [namespace, rulesUrl, silencesUrl, useAlertsTenancy, accessCheckLoading],
    [namespace, rulesUrl, silencesUrl, useAlertsTenancy, accessCheckLoading],
  );

  usePoll(fetchDispatch, POLLING_INTERVAL_MS, dependencies);

  return { trigger: fetchDispatch };
};
