import {
  K8sResourceKind,
  useK8sWatchResource,
  WatchK8sResult,
} from '@openshift-console/dynamic-plugin-sdk';
import { NoModelError } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/hooks/k8s-watcher';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getCapabilityDefinitions } from '@/features/overview/assets/capabilities-definitions';
import { COO_NAME, RequirementGroupVersionKinds } from '@/features/overview/constants/const';
import { ObservabilityCapability, RequirementKind } from '@/features/overview/types/types';
import {
  findInstalledOperator,
  getObservabilityCapability,
} from '@/features/overview/utils/services-utils';

const NO_MODEL_MESSAGE = new NoModelError().message;

const useWatchedRequirement = (requirementKind: RequirementKind, enabled = false) =>
  useK8sWatchResource<K8sResourceKind[]>(
    enabled
      ? {
          isList: true,
          groupVersionKind: RequirementGroupVersionKinds[requirementKind],
          optional: true,
        }
      : null,
  );

export const useObservabilityCapabilities = (
  csvResults: WatchK8sResult<K8sResourceKind[]>,
): {
  observabilityCapabilities: ObservabilityCapability[];
  monitoringPlugin: K8sResourceKind;
  loaded: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadError: any;
} => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [csvs, csvsLoaded] = csvResults;
  const enabled = csvsLoaded ? Boolean(findInstalledOperator(COO_NAME, csvs ?? [])) : false;

  const uiPluginResults = useWatchedRequirement(RequirementKind.UIPlugin, enabled);
  const alertManagerResults = useWatchedRequirement(RequirementKind.Alertmanager, enabled);
  const monitoringStackResults = useWatchedRequirement(RequirementKind.MonitoringStack, enabled);
  const prometheusResults = useWatchedRequirement(RequirementKind.Prometheus, enabled);
  const lokiStackResults = useWatchedRequirement(RequirementKind.LokiStack, enabled);
  const clusterLogForwarderResults = useWatchedRequirement(
    RequirementKind.ClusterLogForwarder,
    enabled,
  );
  const tempoStackResults = useWatchedRequirement(RequirementKind.TempoStack, enabled);
  const openTelemetryCollectorResults = useWatchedRequirement(
    RequirementKind.OpenTelemetryCollector,
    enabled,
  );
  const flowCollectorResults = useWatchedRequirement(RequirementKind.FlowCollector, enabled);

  const requirementResources: Record<
    RequirementKind,
    ReturnType<typeof useWatchedRequirement>
  > = useMemo(
    () => ({
      [RequirementKind.ClusterServiceVersion]: enabled ? csvResults : [[], true, false],
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
      enabled,
      alertManagerResults,
      clusterLogForwarderResults,
      csvResults,
      flowCollectorResults,
      lokiStackResults,
      monitoringStackResults,
      openTelemetryCollectorResults,
      prometheusResults,
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
