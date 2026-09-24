import {
  K8sResourceKind,
  useK8sWatchResource,
  WatchK8sResult,
} from '@openshift-console/dynamic-plugin-sdk';
import { NoModelError } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/hooks/k8s-watcher';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getCapabilityDefinitions } from '@/features/overview/assets/capabilities-definitions';
import { RequirementGroupVersionKinds } from '@/features/overview/constants/const';
import { ObservabilityCapability, RequirementKind } from '@/features/overview/types/types';
import {
  getInstallingSubscriptions,
  getObservabilityCapability,
} from '@/features/overview/utils/services-utils';

const NO_MODEL_MESSAGE = new NoModelError().message;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WatchedRequirementResults = [K8sResourceKind[], boolean, any];

const useWatchedRequirement = (requirementKind: RequirementKind) =>
  useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    groupVersionKind: RequirementGroupVersionKinds[requirementKind],
    optional: true,
  });

const getInstalledSubscriptionsResults = (
  csvResults: WatchedRequirementResults,
  subscriptionResults: WatchedRequirementResults,
): WatchedRequirementResults => {
  const [csvs, csvsLoaded, csvsError] = csvResults;
  const [subscriptions, subscriptionsLoaded, subscriptionsError] = subscriptionResults;

  const loaded = csvsLoaded && subscriptionsLoaded;
  const error = csvsError || subscriptionsError;

  return [getInstallingSubscriptions(subscriptions, csvs), loaded, error];
};

export const useObservabilityCapabilities = (
  csvResults: WatchK8sResult<K8sResourceKind[]>,
): {
  observabilityCapabilities: ObservabilityCapability[];
  monitoringPlugin: K8sResourceKind | undefined;
  loaded: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadError: any;
} => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const subscriptionResults = useWatchedRequirement(RequirementKind.Subscription);
  const uiPluginResults = useWatchedRequirement(RequirementKind.UIPlugin);
  const alertManagerResults = useWatchedRequirement(RequirementKind.Alertmanager);
  const monitoringStackResults = useWatchedRequirement(RequirementKind.MonitoringStack);
  const prometheusResults = useWatchedRequirement(RequirementKind.Prometheus);
  const lokiStackResults = useWatchedRequirement(RequirementKind.LokiStack);
  const clusterLogForwarderResults = useWatchedRequirement(RequirementKind.ClusterLogForwarder);
  const tempoStackResults = useWatchedRequirement(RequirementKind.TempoStack);
  const openTelemetryCollectorResults = useWatchedRequirement(
    RequirementKind.OpenTelemetryCollector,
  );
  const flowCollectorResults = useWatchedRequirement(RequirementKind.FlowCollector);

  const requirementResources: Record<
    RequirementKind,
    ReturnType<typeof useWatchedRequirement>
  > = useMemo(
    () => ({
      [RequirementKind.ClusterServiceVersion]: csvResults,
      [RequirementKind.Subscription]: getInstalledSubscriptionsResults(
        csvResults,
        subscriptionResults,
      ),
      [RequirementKind.UIPlugin]: uiPluginResults,
      [RequirementKind.Alertmanager]: alertManagerResults,
      [RequirementKind.MonitoringStack]: monitoringStackResults,
      [RequirementKind.Prometheus]: prometheusResults,
      [RequirementKind.LokiStack]: lokiStackResults,
      [RequirementKind.ClusterLogForwarder]: clusterLogForwarderResults,
      [RequirementKind.TempoStack]: tempoStackResults,
      [RequirementKind.OpenTelemetryCollector]: openTelemetryCollectorResults,
      [RequirementKind.FlowCollector]: flowCollectorResults,
    }),
    [
      alertManagerResults,
      clusterLogForwarderResults,
      csvResults,
      flowCollectorResults,
      lokiStackResults,
      monitoringStackResults,
      openTelemetryCollectorResults,
      prometheusResults,
      subscriptionResults,
      tempoStackResults,
      uiPluginResults,
    ],
  );

  const loaded = Object.values(requirementResources).every(
    ([, resourceLoaded, resourceError]) => resourceLoaded || resourceError,
  );
  const loadError = Object.values(requirementResources).find(
    ([, , resourceError]) => resourceError && resourceError.message !== NO_MODEL_MESSAGE,
  )?.[2];

  const observabilityServices = useMemo(() => {
    const capabilityDefinitions = getCapabilityDefinitions(t);
    return capabilityDefinitions.map((definition) =>
      getObservabilityCapability(definition, requirementResources),
    );
  }, [t, requirementResources]);

  return {
    observabilityCapabilities: observabilityServices,
    monitoringPlugin: uiPluginResults?.[0]?.find((result) => result.metadata.name === 'monitoring'),
    loaded,
    loadError,
  };
};
