import { K8sGroupVersionKind, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { isEmpty } from 'lodash-es';

import {
  CSV_GROUP_VERSION_KIND,
  DEFAULT_CR_NAMESPACE,
  RequirementGroupVersionKinds,
  UIPluginGroupVersionKind,
} from '@/features/overview/constants/const';
import {
  CapabilityDefinition,
  CapabilityStatus,
  ObservabilityCapability,
  RequiredConfig,
  RequiredConfigType,
  RequiredOperator,
  RequirementKind,
  RequirementStatus,
} from '@/features/overview/types/types';

export type RequirementResources = Record<
  RequirementKind,
  [K8sResourceKind[] | undefined, boolean, unknown]
>;

export const getCSVPackageName = (csv: K8sResourceKind): string | undefined => {
  const operatorLabel = Object.keys(csv?.metadata?.labels ?? {}).find((label) =>
    label.startsWith('operators.coreos.com/'),
  );

  if (operatorLabel) {
    return operatorLabel.replace('operators.coreos.com/', '').split('.')[0];
  }

  return csv?.metadata?.name?.split('.')[0];
};

export const isUiPluginInstalled = (
  pluginType: string,
  uiPlugins: K8sResourceKind[] = [],
): boolean =>
  Boolean(pluginType) &&
  uiPlugins.some((plugin) => plugin.spec?.type?.toLowerCase() === pluginType.toLowerCase());

export const findInstalledOperator = (
  packageName: string,
  csvs: K8sResourceKind[],
): K8sResourceKind | undefined => {
  const candidates =
    csvs?.filter(
      (candidate) =>
        candidate.status?.reason !== 'Copied' && getCSVPackageName(candidate) === packageName,
    ) ?? [];
  if (!candidates.length) {
    return undefined;
  }

  const runningOperator = candidates.find((candidate) => candidate.status?.phase === 'Succeeded');
  return runningOperator ?? candidates[candidates.length - 1];
};

export const groupVersionKindToPath = (gvk: K8sGroupVersionKind): string =>
  `${gvk.group}~${gvk.version}~${gvk.kind}`;

export const editResourceKindPath = (resource: K8sResourceKind): string => {
  const [group, version] = resource.apiVersion.split('/');
  if (!group || !version) {
    return '#';
  }

  const base = resource.metadata.namespace
    ? `/k8s/ns/${resource.metadata.namespace}`
    : '/k8s/cluster';

  return (
    `${base}/${groupVersionKindToPath({ group, version, kind: resource.kind })}/` +
    `${resource.metadata.name}/yaml`
  );
};

export const getNewPluginURL = (coo: K8sResourceKind): string =>
  coo
    ? `/k8s/ns/` +
      `${coo.metadata.namespace}/` +
      `${CSV_GROUP_VERSION_KIND}/` +
      `${coo.metadata.name}/` +
      `${groupVersionKindToPath(UIPluginGroupVersionKind)}/` +
      `~new`
    : '#';

const ALM_EXAMPLES_ANNOTATION = 'alm-examples';

export const getNamespaceFromAlmExamples = (
  csv: K8sResourceKind | undefined,
  kind: string,
): string | undefined => {
  const raw = csv?.metadata?.annotations?.[ALM_EXAMPLES_ANNOTATION];
  if (!raw) {
    return undefined;
  }

  try {
    const examples: K8sResourceKind[] = JSON.parse(raw);
    return examples.find((example) => example.kind === kind)?.metadata?.namespace;
  } catch {
    return undefined;
  }
};

export const buildNamespacedCreateResourcePath = (
  namespace: string,
  groupVersionKind: K8sGroupVersionKind,
): string => `/k8s/ns/${namespace}/${groupVersionKindToPath(groupVersionKind)}/~new`;

export const buildClusterCreateResourcePath = (groupVersionKind: K8sGroupVersionKind): string =>
  `/k8s/cluster/${groupVersionKindToPath(groupVersionKind)}/~new`;

const findOwningOperator = (
  config: RequiredConfig,
  requiredOperators: RequiredOperator[],
): RequiredOperator | undefined => {
  if (config.requiredOperatorId) {
    return requiredOperators.find((operator) => operator.id === config.requiredOperatorId);
  }

  return requiredOperators.find((operator) => operator.csv);
};

/**
 * Resolves a Console URL for creating a required custom resource.
 *
 * Fallback order:
 * 1. Cluster-scoped CRD (`config.clusterScoped`)
 * 2. Namespace from the owning operator CSV's `alm-examples`
 * 3. Catalog default (`config.createNamespace`)
 * 4. Owning operator CSV details page (user creates from the operator UI)
 */
export const getCreateResourceURL = (
  config: RequiredConfig,
  requiredOperators: RequiredOperator[],
): string | undefined => {
  if (config.type !== RequiredConfigType.CustomResource || !config.groupVersionKind) {
    return undefined;
  }

  const { groupVersionKind } = config;

  if (config.clusterScoped) {
    return buildClusterCreateResourcePath(groupVersionKind);
  }

  const owningOperator = findOwningOperator(config, requiredOperators);
  const almExampleNamespace = getNamespaceFromAlmExamples(
    owningOperator?.csv,
    groupVersionKind.kind,
  );
  if (almExampleNamespace) {
    return buildNamespacedCreateResourcePath(almExampleNamespace, groupVersionKind);
  }

  return buildNamespacedCreateResourcePath(
    config.createNamespace || DEFAULT_CR_NAMESPACE,
    groupVersionKind,
  );
};

const getRequiredOperatorStatus = (operator?: K8sResourceKind): RequirementStatus => {
  if (!operator) {
    return RequirementStatus.Missing;
  }
  if (operator.status?.phase === 'Succeeded') {
    return RequirementStatus.Success;
  }
  return RequirementStatus.Degraded;
};

const getRequiredConfigStatus = (
  config: CapabilityDefinition['requiredConfigs'][number],
  requirementResources: RequirementResources,
): RequirementStatus => {
  const [uiPlugins] = requirementResources[RequirementKind.UIPlugin];

  if (config.type === RequiredConfigType.UiPlugin) {
    return isUiPluginInstalled(config.pluginName ?? '', uiPlugins)
      ? RequirementStatus.Success
      : RequirementStatus.Missing;
  }

  if (config.type === RequiredConfigType.MonitoringFeature) {
    const monitoringPlugin = uiPlugins?.find((plugin) => plugin.metadata.name === 'monitoring');
    return monitoringPlugin?.spec?.monitoring?.[config.featureName]?.enabled === true
      ? RequirementStatus.Success
      : RequirementStatus.Missing;
  }

  if (!config.groupVersionKind) {
    return RequirementStatus.Missing;
  }

  const [resources, loaded, error] = requirementResources[config.groupVersionKind] ?? [
    [],
    false,
    undefined,
  ];
  if (!loaded || error) {
    return RequirementStatus.Missing;
  }
  return resources?.length ? RequirementStatus.Success : RequirementStatus.Missing;
};

const getCapabilityStatus = (
  requiredOperators: RequiredOperator[],
  requiredConfigs: RequiredConfig[],
): CapabilityStatus => {
  const statuses = [
    ...requiredOperators.map((operator) => operator.status),
    ...requiredConfigs.map((config) => config.status ?? RequirementStatus.Missing),
  ];

  if (isEmpty(statuses) || statuses.every((status) => status === RequirementStatus.Success)) {
    return CapabilityStatus.Ready;
  }
  if (statuses.every((status) => status === RequirementStatus.Missing)) {
    return CapabilityStatus.Available;
  }
  return CapabilityStatus.Partial;
};

const isCapabilityLoaded = (
  definition: CapabilityDefinition,
  requirementResources: RequirementResources,
): boolean => {
  const requirementKinds = new Set<RequirementKind>();

  if (!isEmpty(definition.requiredOperators)) {
    requirementKinds.add(RequirementKind.ClusterServiceVersion);
  }

  definition.requiredConfigs.forEach((config) => {
    if (
      config.type === RequiredConfigType.UiPlugin ||
      config.type === RequiredConfigType.MonitoringFeature
    ) {
      requirementKinds.add(RequirementKind.UIPlugin);
    }
    if (config.groupVersionKind) {
      requirementKinds.add(config.groupVersionKind);
    }
  });

  return [...requirementKinds].every((kind) => requirementResources[kind]?.[1]);
};

const isOperatorInstalled = (requiredOperator?: RequiredOperator) =>
  requiredOperator?.status === RequirementStatus.Success ||
  requiredOperator?.status === RequirementStatus.Degraded;

export const getObservabilityCapability = (
  definition: CapabilityDefinition,
  requirementResources: RequirementResources,
): ObservabilityCapability => {
  const [csvs] = requirementResources[RequirementKind.ClusterServiceVersion];

  const requiredOperators: RequiredOperator[] = definition.requiredOperators.map((operator) => {
    const installedOperator = findInstalledOperator(operator.operatorName, csvs);
    const missingPrerequisite = Boolean(
      operator.preRequisiteOperator &&
      findInstalledOperator(operator.preRequisiteOperator, csvs) === undefined,
    );
    const status = missingPrerequisite
      ? RequirementStatus.Missing
      : getRequiredOperatorStatus(installedOperator);

    return {
      id: operator.id,
      title: operator.title,
      groupVersionKind: RequirementGroupVersionKinds[RequirementKind.ClusterServiceVersion],
      keywords: operator.keywords,
      status,
      message:
        status === RequirementStatus.Degraded ? installedOperator?.status?.message : undefined,
      csv: installedOperator,
      missingPrerequisite,
    };
  });

  const requiredConfigs: RequiredConfig[] = definition.requiredConfigs.map((config) => ({
    id: config.id,
    title: config.title,
    type: config.type,
    groupVersionKind: config.groupVersionKind
      ? RequirementGroupVersionKinds[config.groupVersionKind]
      : undefined,
    pluginName: config.pluginName,
    featureName: config.featureName,
    requiredOperatorId: config.requiredOperatorId,
    createNamespace: config.createNamespace,
    clusterScoped: config.clusterScoped,
    status: getRequiredConfigStatus(config, requirementResources),
    isRequiredOperatorInstalled: config.requiredOperatorId
      ? isOperatorInstalled(
          requiredOperators.find(
            (requiredOperator) => requiredOperator.id === config.requiredOperatorId,
          ),
        )
      : true,
  }));

  return {
    id: definition.id,
    isAdvanced: definition.isAdvanced,
    title: definition.title,
    requiredLabels: definition.requiredLabels,
    description: definition.description,
    learnMoreUrl: definition.learnMoreUrl,
    loaded: isCapabilityLoaded(definition, requirementResources),
    status: getCapabilityStatus(requiredOperators, requiredConfigs),
    requiredOperators,
    requiredConfigs,
  };
};
