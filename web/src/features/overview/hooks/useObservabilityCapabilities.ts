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
import {
  ObservabilityCapability,
  RequirementGroupVersionKind,
} from '@/features/overview/types/types';
import {
  findInstalledOperator,
  getObservabilityCapability,
} from '@/features/overview/utils/services-utils';

const NO_MODEL_MESSAGE = new NoModelError().message;

const useWatchedRequirement = (requirementKind: RequirementGroupVersionKind, enabled = false) =>
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

  const uiPluginResults = useWatchedRequirement(RequirementGroupVersionKind.UIPlugin, enabled);
  const alertManagerResults = useWatchedRequirement(
    RequirementGroupVersionKind.Alertmanager,
    enabled,
  );
  const monitoringStackResults = useWatchedRequirement(
    RequirementGroupVersionKind.MonitoringStack,
    enabled,
  );
  const prometheusResults = useWatchedRequirement(RequirementGroupVersionKind.Prometheus, enabled);
  const lokiStackResults = useWatchedRequirement(RequirementGroupVersionKind.LokiStack, enabled);
  const clusterLogForwarderResults = useWatchedRequirement(
    RequirementGroupVersionKind.ClusterLogForwarder,
    enabled,
  );
  const tempoStackResults = useWatchedRequirement(RequirementGroupVersionKind.TempoStack, enabled);
  const openTelemetryCollectorResults = useWatchedRequirement(
    RequirementGroupVersionKind.OpenTelemetryCollector,
    enabled,
  );
  const flowCollectorResults = useWatchedRequirement(
    RequirementGroupVersionKind.FlowCollector,
    enabled,
  );

  const requirementResources: Record<
    RequirementGroupVersionKind,
    ReturnType<typeof useWatchedRequirement>
  > = useMemo(
    () => ({
      [RequirementGroupVersionKind.ClusterServiceVersion]: enabled ? csvResults : [[], true, false],
      [RequirementGroupVersionKind.UIPlugin]: uiPluginResults,
      [RequirementGroupVersionKind.Alertmanager]: alertManagerResults,
      [RequirementGroupVersionKind.MonitoringStack]: monitoringStackResults,
      [RequirementGroupVersionKind.Prometheus]: prometheusResults,
      [RequirementGroupVersionKind.LokiStack]: lokiStackResults,
      [RequirementGroupVersionKind.ClusterLogForwarder]: clusterLogForwarderResults,
      [RequirementGroupVersionKind.TempoStack]: tempoStackResults,
      [RequirementGroupVersionKind.OpenTelemetryCollector]: openTelemetryCollectorResults,
      [RequirementGroupVersionKind.FlowCollector]: flowCollectorResults,
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
