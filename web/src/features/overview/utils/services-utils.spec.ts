import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import {
  COO_ID,
  COO_NAME,
  RequirementGroupVersionKinds,
} from '@/features/overview/constants/const';
import {
  CapabilityDefinition,
  CapabilityStatus,
  RequiredConfig,
  RequiredConfigType,
  RequiredOperator,
  RequirementKind,
  RequirementStatus,
} from '@/features/overview/types/types';
import {
  buildNamespacedCreateResourcePath,
  editResourceKindPath,
  findInstalledOperator,
  getCreateResourceURL,
  getCSVPackageName,
  getInstallingSubscriptions,
  getNamespaceFromAlmExamples,
  getNewPluginURL,
  getObservabilityCapability,
  groupVersionKindToPath,
  isUiPluginInstalled,
  RequirementResources,
} from '@/features/overview/utils/services-utils';

const cooCSV = (phase = 'Succeeded', message?: string): K8sResourceKind => ({
  metadata: {
    name: 'cluster-observability-operator.v1.2.0',
    namespace: 'openshift-cluster-observability-operator',
    labels: {
      'operators.coreos.com/cluster-observability-operator.openshift-cluster-observability-operator':
        '',
    },
  },
  status: { phase, message },
});

const cooOperatorDefinition = {
  id: COO_ID,
  title: 'Cluster Observability Operator',
  operatorName: COO_NAME,
  keywords: 'cluster observability operator',
};

/**
 * Builds a fully populated RequirementResources record — every kind loaded with an
 * empty result — so individual tests only declare the kinds they care about.
 */
const buildRequirementResources = (
  overrides: Partial<RequirementResources> = {},
): RequirementResources => {
  const resources = {} as RequirementResources;
  Object.values(RequirementKind).forEach((kind) => {
    resources[kind] = [[], true, undefined];
  });
  return { ...resources, ...overrides };
};

describe('getCSVPackageName', () => {
  it('derives the package name from the operators.coreos.com label', () => {
    expect(getCSVPackageName(cooCSV())).toEqual('cluster-observability-operator');
  });

  it('falls back to the CSV name when no operator label is present', () => {
    expect(
      getCSVPackageName({ metadata: { name: 'loki-operator.v6.1.0', labels: { app: 'loki' } } }),
    ).toEqual('loki-operator');
  });

  it('returns undefined when there is no name and no label', () => {
    expect(getCSVPackageName({ metadata: {} })).toBeUndefined();
    expect(getCSVPackageName(undefined)).toBeUndefined();
  });

  it('derives the package name from olm.properties when the operator label is absent', () => {
    expect(
      getCSVPackageName({
        metadata: {
          name: 'some-unrelated-name',
          annotations: {
            'olm.properties':
              '[{"type":"olm.package","value":{"packageName":"cluster-observability-operator","version":"1.2.0"}}]',
          },
        },
      }),
    ).toEqual('cluster-observability-operator');
  });
});

describe('isUiPluginInstalled', () => {
  const uiPlugins: K8sResourceKind[] = [
    { metadata: { name: 'monitoring' }, spec: { type: 'Monitoring' } },
    { metadata: { name: 'logging' }, spec: { type: 'Logging' } },
  ];

  it('matches the plugin type case-insensitively', () => {
    expect(isUiPluginInstalled('monitoring', uiPlugins)).toBe(true);
    expect(isUiPluginInstalled('LOGGING', uiPlugins)).toBe(true);
  });

  it('returns false for a type that is not installed', () => {
    expect(isUiPluginInstalled('TroubleshootingPanel', uiPlugins)).toBe(false);
  });

  it('returns false for an empty plugin type', () => {
    expect(isUiPluginInstalled('', uiPlugins)).toBe(false);
  });

  it('returns false when no plugins are passed', () => {
    expect(isUiPluginInstalled('monitoring')).toBe(false);
    expect(isUiPluginInstalled('monitoring', [])).toBe(false);
  });
});

describe('findInstalledOperator', () => {
  it('returns undefined when no CSV matches the package name', () => {
    expect(findInstalledOperator('tempo-operator', [cooCSV()])).toBeUndefined();
  });

  it('ignores CSVs copied into other namespaces', () => {
    const copied: K8sResourceKind = {
      ...cooCSV(),
      status: { phase: 'Succeeded', reason: 'Copied' },
    };
    expect(findInstalledOperator('cluster-observability-operator', [copied])).toBeUndefined();
  });

  it('ignores CSVs with the olm.copiedFrom label even when reason is not Copied', () => {
    const copied: K8sResourceKind = {
      ...cooCSV(),
      status: { phase: 'Succeeded' },
      metadata: {
        ...cooCSV().metadata,
        labels: {
          ...cooCSV().metadata.labels,
          'olm.copiedFrom': 'openshift-cluster-observability-operator',
        },
      },
    };
    expect(findInstalledOperator('cluster-observability-operator', [copied])).toBeUndefined();
  });

  it('ignores non-standalone dependency CSVs unless they failed', () => {
    const dependency: K8sResourceKind = {
      ...cooCSV(),
      metadata: {
        ...cooCSV().metadata,
        annotations: {
          'operators.operatorframework.io/operator-type': 'non-standalone',
        },
      },
    };
    expect(findInstalledOperator('cluster-observability-operator', [dependency])).toBeUndefined();

    const failedDependency: K8sResourceKind = {
      ...dependency,
      status: { phase: 'Failed', message: 'install failed' },
    };
    expect(findInstalledOperator('cluster-observability-operator', [failedDependency])).toBe(
      failedDependency,
    );
  });

  it('prefers a Succeeded CSV over other candidates', () => {
    const installing = cooCSV('Installing');
    const succeeded = cooCSV('Succeeded');
    expect(findInstalledOperator('cluster-observability-operator', [installing, succeeded])).toBe(
      succeeded,
    );
  });

  it('prefers the newest Succeeded CSV when several match', () => {
    const older: K8sResourceKind = {
      ...cooCSV('Succeeded'),
      status: { phase: 'Succeeded', lastUpdateTime: '2024-01-01T00:00:00Z' },
    };
    const newer: K8sResourceKind = {
      ...cooCSV('Succeeded'),
      status: { phase: 'Succeeded', lastUpdateTime: '2024-06-01T00:00:00Z' },
    };
    expect(findInstalledOperator('cluster-observability-operator', [older, newer])).toBe(newer);
  });

  it('falls back to the newest candidate when none have succeeded', () => {
    const installing: K8sResourceKind = {
      ...cooCSV('Installing'),
      status: { phase: 'Installing', lastUpdateTime: '2024-01-01T00:00:00Z' },
    };
    const failed: K8sResourceKind = {
      ...cooCSV('Failed'),
      status: { phase: 'Failed', lastUpdateTime: '2024-06-01T00:00:00Z' },
    };
    expect(findInstalledOperator('cluster-observability-operator', [installing, failed])).toBe(
      failed,
    );
  });
});

describe('getInstallingSubscriptions', () => {
  const lokiSubscription: K8sResourceKind = {
    metadata: { name: 'loki-operator', namespace: 'openshift-operators' },
    spec: { startingCSV: 'loki-operator.v3.2.1' },
    status: { currentCSV: 'loki-operator.v3.2.1' },
  };

  it('returns subscriptions that have no installed CSV and no matching cluster CSV yet', () => {
    expect(getInstallingSubscriptions([lokiSubscription], [])).toEqual([lokiSubscription]);
  });

  it('excludes subscriptions that already report an installed CSV', () => {
    const installed: K8sResourceKind = {
      ...lokiSubscription,
      status: { ...lokiSubscription.status, installedCSV: 'loki-operator.v3.2.1' },
    };

    expect(getInstallingSubscriptions([installed], [])).toEqual([]);
  });

  it('excludes subscriptions when a CSV matches currentCSV or startingCSV', () => {
    const csv: K8sResourceKind = {
      metadata: { name: 'loki-operator.v3.2.1', namespace: 'openshift-operators' },
      status: { phase: 'Installing' },
    };

    expect(getInstallingSubscriptions([lokiSubscription], [csv])).toEqual([]);
  });

  it('returns an empty list when subscriptions are undefined', () => {
    expect(getInstallingSubscriptions(undefined, [])).toEqual([]);
  });
});

describe('getNewPluginURL', () => {
  it('builds a create-UIPlugin path scoped to the operator namespace', () => {
    expect(getNewPluginURL(cooCSV())).toEqual(
      '/k8s/ns/openshift-cluster-observability-operator/' +
        'operators.coreos.com~v1alpha1~ClusterServiceVersion/' +
        'cluster-observability-operator.v1.2.0/' +
        'observability.openshift.io~v1alpha1~UIPlugin/~new',
    );
  });

  it('returns a no-op href when the operator is not installed', () => {
    expect(getNewPluginURL(undefined)).toEqual('#');
  });
});

const monitoringStackGVK = RequirementGroupVersionKinds[RequirementKind.MonitoringStack];

const buildCustomResourceConfig = (overrides: Partial<RequiredConfig> = {}): RequiredConfig => ({
  id: 'monitoring-stack',
  title: 'COO MonitoringStack CR',
  type: RequiredConfigType.CustomResource,
  groupVersionKind: monitoringStackGVK,
  requiredOperatorId: COO_ID,
  isRequiredOperatorInstalled: true,
  status: RequirementStatus.Missing,
  ...overrides,
});

const buildRequiredOperator = (overrides: Partial<RequiredOperator> = {}): RequiredOperator => ({
  id: COO_ID,
  title: 'Cluster Observability Operator',
  groupVersionKind: RequirementGroupVersionKinds[RequirementKind.ClusterServiceVersion],
  keywords: 'cluster observability operator',
  status: RequirementStatus.Success,
  csv: cooCSV(),
  ...overrides,
});

describe('getNamespaceFromAlmExamples', () => {
  it('returns the namespace from a matching alm-example', () => {
    const csv: K8sResourceKind = {
      metadata: {
        annotations: {
          'alm-examples':
            '[{"apiVersion":"monitoring.rhobs/v1alpha1","kind":"MonitoringStack","metadata":{"name":"sample","namespace":"openshift-monitoring"}}]',
        },
      },
    };

    expect(getNamespaceFromAlmExamples(csv, 'MonitoringStack')).toEqual('openshift-monitoring');
  });

  it('returns undefined when the annotation is missing or invalid', () => {
    expect(getNamespaceFromAlmExamples(cooCSV(), 'MonitoringStack')).toBeUndefined();
    expect(
      getNamespaceFromAlmExamples(
        { metadata: { annotations: { 'alm-examples': 'not-json' } } },
        'MonitoringStack',
      ),
    ).toBeUndefined();
  });
});

describe('getCreateResourceURL', () => {
  it('uses alm-examples before the catalog default namespace', () => {
    const operator = buildRequiredOperator({
      csv: {
        metadata: {
          ...cooCSV().metadata,
          annotations: {
            'alm-examples':
              '[{"apiVersion":"monitoring.rhobs/v1alpha1","kind":"MonitoringStack","metadata":{"name":"sample","namespace":"openshift-monitoring"}}]',
          },
        },
      },
    });

    expect(
      getCreateResourceURL(buildCustomResourceConfig({ createNamespace: 'default' }), [operator]),
    ).toEqual(buildNamespacedCreateResourcePath('openshift-monitoring', monitoringStackGVK));
  });

  it('uses the catalog default namespace when no stronger signal exists', () => {
    expect(
      getCreateResourceURL(buildCustomResourceConfig({ createNamespace: 'openshift-monitoring' }), [
        buildRequiredOperator(),
      ]),
    ).toEqual(buildNamespacedCreateResourcePath('openshift-monitoring', monitoringStackGVK));
  });

  it('returns undefined for non-custom-resource configs', () => {
    expect(
      getCreateResourceURL(
        {
          id: 'perses',
          title: 'Perses',
          type: RequiredConfigType.MonitoringFeature,
          featureName: 'perses',
        },
        [buildRequiredOperator()],
      ),
    ).toBeUndefined();
  });
});

describe('editResourceKindPath', () => {
  it('builds a cluster-scoped yaml edit path when the resource has no namespace', () => {
    expect(
      editResourceKindPath({
        apiVersion: 'observability.openshift.io/v1alpha1',
        kind: 'UIPlugin',
        metadata: { name: 'monitoring' },
      }),
    ).toEqual('/k8s/cluster/observability.openshift.io~v1alpha1~UIPlugin/monitoring/yaml');
  });

  it('builds a namespace-scoped yaml edit path when the resource has a namespace', () => {
    expect(
      editResourceKindPath({
        apiVersion: 'monitoring.rhobs/v1alpha1',
        kind: 'MonitoringStack',
        metadata: { name: 'sample', namespace: 'openshift-monitoring' },
      }),
    ).toEqual('/k8s/ns/openshift-monitoring/monitoring.rhobs~v1alpha1~MonitoringStack/sample/yaml');
  });

  it('returns a no-op href when apiVersion has no group', () => {
    expect(
      editResourceKindPath({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'sample' },
      }),
    ).toEqual('#');
  });
});

describe('groupVersionKindToPath', () => {
  it('joins group, version, and kind with tildes', () => {
    expect(
      groupVersionKindToPath({
        group: 'monitoring.rhobs',
        version: 'v1alpha1',
        kind: 'MonitoringStack',
      }),
    ).toEqual('monitoring.rhobs~v1alpha1~MonitoringStack');
  });
});

describe('getObservabilityCapability', () => {
  const monitoringDefinition: CapabilityDefinition = {
    id: 'monitoring',
    title: 'Monitoring',
    description: 'Collect metrics and manage alerting across cluster workloads.',
    requiredOperators: [cooOperatorDefinition],
    requiredConfigs: [
      {
        id: 'monitoring-stack',
        title: 'COO MonitoringStack CR',
        type: RequiredConfigType.CustomResource,
        groupVersionKind: RequirementKind.MonitoringStack,
        requiredOperatorId: COO_ID,
      },
    ],
  };

  const monitoringStack: K8sResourceKind = { metadata: { name: 'sample-monitoring-stack' } };

  it('reports Ready when every operator and config is satisfied', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [[cooCSV()], true, undefined],
        [RequirementKind.MonitoringStack]: [[monitoringStack], true, undefined],
      }),
    );

    expect(capability.status).toEqual(CapabilityStatus.Ready);
    expect(capability.requiredOperators[0].status).toEqual(RequirementStatus.Success);
    expect(capability.requiredConfigs[0].status).toEqual(RequirementStatus.Success);
    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(true);
  });

  it('reports Available when nothing is installed or configured', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources(),
    );

    expect(capability.status).toEqual(CapabilityStatus.Available);
    expect(capability.requiredOperators[0].status).toEqual(RequirementStatus.Missing);
    expect(capability.requiredConfigs[0].status).toEqual(RequirementStatus.Missing);
    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(false);
  });

  it('reports Partial when the operator is installed but the config is missing', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [[cooCSV()], true, undefined],
      }),
    );

    expect(capability.status).toEqual(CapabilityStatus.Partial);
    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(true);
  });

  it('surfaces the CSV message for a degraded operator and still treats it as installed', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [
          [cooCSV('Failed', 'install plan failed')],
          true,
          undefined,
        ],
      }),
    );

    expect(capability.requiredOperators[0].status).toEqual(RequirementStatus.Degraded);
    expect(capability.requiredOperators[0].message).toEqual('install plan failed');
    expect(capability.status).toEqual(CapabilityStatus.Partial);
    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(true);
  });

  it('does not attach a message when the operator is healthy', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [
          [cooCSV('Succeeded', 'all good')],
          true,
          undefined,
        ],
      }),
    );

    expect(capability.requiredOperators[0].message).toBeUndefined();
  });

  it('reports Ready when a capability declares no requirements at all', () => {
    const capability = getObservabilityCapability(
      { ...monitoringDefinition, requiredOperators: [], requiredConfigs: [] },
      buildRequirementResources(),
    );

    expect(capability.status).toEqual(CapabilityStatus.Ready);
  });

  it('treats a config as missing when its watch errored, even while loaded', () => {
    const capability = getObservabilityCapability(
      monitoringDefinition,
      buildRequirementResources({
        [RequirementKind.MonitoringStack]: [[monitoringStack], true, new Error('forbidden')],
      }),
    );

    expect(capability.requiredConfigs[0].status).toEqual(RequirementStatus.Missing);
  });

  it('marks a config as not requiring an operator when requiredOperatorId is unset', () => {
    const capability = getObservabilityCapability(
      {
        ...monitoringDefinition,
        requiredConfigs: [
          {
            id: 'monitoring-stack',
            title: 'COO MonitoringStack CR',
            type: RequiredConfigType.CustomResource,
            groupVersionKind: RequirementKind.MonitoringStack,
          },
        ],
      },
      buildRequirementResources(),
    );

    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(true);
  });

  it('does not claim an operator is installed when requiredOperatorId matches no operator', () => {
    const capability = getObservabilityCapability(
      {
        ...monitoringDefinition,
        requiredConfigs: [
          {
            id: 'loki-stack',
            title: 'LokiStack CR',
            type: RequiredConfigType.CustomResource,
            groupVersionKind: RequirementKind.LokiStack,
            requiredOperatorId: 'operator-that-is-not-declared',
          },
        ],
      },
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [[cooCSV()], true, undefined],
      }),
    );

    expect(capability.requiredConfigs[0].isRequiredOperatorInstalled).toBe(false);
  });

  describe('UIPlugin configs', () => {
    const withPluginConfig = (
      config: CapabilityDefinition['requiredConfigs'][number],
    ): CapabilityDefinition => ({
      ...monitoringDefinition,
      requiredOperators: [],
      requiredConfigs: [config],
    });

    const monitoringPlugin = (persesEnabled: boolean): K8sResourceKind => ({
      metadata: { name: 'monitoring' },
      spec: { type: 'Monitoring', monitoring: { perses: { enabled: persesEnabled } } },
    });

    it('resolves by plugin type when only pluginName is given', () => {
      const definition = withPluginConfig({
        id: 'monitoring-ui',
        title: 'COO Monitoring UI Plugin CR',
        type: RequiredConfigType.UiPlugin,
        groupVersionKind: RequirementKind.UIPlugin,
        pluginName: 'monitoring',
      });

      expect(
        getObservabilityCapability(
          definition,
          buildRequirementResources({
            [RequirementKind.UIPlugin]: [[monitoringPlugin(false)], true, undefined],
          }),
        ).requiredConfigs[0].status,
      ).toEqual(RequirementStatus.Success);
    });

    it('reports Missing when the plugin type is not installed', () => {
      const definition = withPluginConfig({
        id: 'logging-ui',
        title: 'COO Logging UI Plugin CR',
        type: RequiredConfigType.UiPlugin,
        groupVersionKind: RequirementKind.UIPlugin,
        pluginName: 'Logging',
      });

      expect(
        getObservabilityCapability(
          definition,
          buildRequirementResources({
            [RequirementKind.UIPlugin]: [[monitoringPlugin(false)], true, undefined],
          }),
        ).requiredConfigs[0].status,
      ).toEqual(RequirementStatus.Missing);
    });
  });

  describe('MonitoringFeature configs', () => {
    const withFeatureConfig = (
      config: CapabilityDefinition['requiredConfigs'][number],
    ): CapabilityDefinition => ({
      ...monitoringDefinition,
      requiredOperators: [],
      requiredConfigs: [config],
    });

    const monitoringPlugin = (features: Record<string, { enabled: boolean }>): K8sResourceKind => ({
      metadata: { name: 'monitoring' },
      spec: { type: 'Monitoring', monitoring: features },
    });

    it('reports Success when the feature is enabled on the monitoring UIPlugin', () => {
      const definition = withFeatureConfig({
        id: 'perses-dashboards',
        title: 'Perses Dashboards',
        type: RequiredConfigType.MonitoringFeature,
        featureName: 'perses',
      });

      expect(
        getObservabilityCapability(
          definition,
          buildRequirementResources({
            [RequirementKind.UIPlugin]: [
              [monitoringPlugin({ perses: { enabled: true } })],
              true,
              undefined,
            ],
          }),
        ).requiredConfigs[0].status,
      ).toEqual(RequirementStatus.Success);
    });

    it('reports Missing when the feature is disabled on the monitoring UIPlugin', () => {
      const definition = withFeatureConfig({
        id: 'perses-dashboards',
        title: 'Perses Dashboards',
        type: RequiredConfigType.MonitoringFeature,
        featureName: 'perses',
      });

      expect(
        getObservabilityCapability(
          definition,
          buildRequirementResources({
            [RequirementKind.UIPlugin]: [
              [monitoringPlugin({ perses: { enabled: false } })],
              true,
              undefined,
            ],
          }),
        ).requiredConfigs[0].status,
      ).toEqual(RequirementStatus.Missing);
    });

    it('reports Missing when the monitoring UIPlugin is not installed', () => {
      const definition = withFeatureConfig({
        id: 'cluster-health-analyzer',
        title: 'COO Monitoring UI Plugin CR (Health Analyzer feature)',
        type: RequiredConfigType.MonitoringFeature,
        featureName: 'clusterHealthAnalyzer',
      });

      expect(
        getObservabilityCapability(
          definition,
          buildRequirementResources({
            [RequirementKind.UIPlugin]: [[], true, undefined],
          }),
        ).requiredConfigs[0].status,
      ).toEqual(RequirementStatus.Missing);
    });

    it('reports Missing while UIPlugin resources are still loading', () => {
      const definition = withFeatureConfig({
        id: 'perses-dashboards',
        title: 'Perses Dashboards',
        type: RequiredConfigType.MonitoringFeature,
        featureName: 'perses',
      });

      const capability = getObservabilityCapability(
        definition,
        buildRequirementResources({
          [RequirementKind.UIPlugin]: [undefined, false, undefined],
        }),
      );

      expect(capability.requiredConfigs[0].status).toEqual(RequirementStatus.Missing);
      expect(capability.loaded).toBe(false);
    });
  });

  describe('loaded', () => {
    it('is false while a kind the capability depends on is still loading', () => {
      const capability = getObservabilityCapability(
        monitoringDefinition,
        buildRequirementResources({
          [RequirementKind.MonitoringStack]: [undefined, false, undefined],
        }),
      );

      expect(capability.loaded).toBe(false);
    });

    it('ignores kinds the capability does not depend on', () => {
      const capability = getObservabilityCapability(
        monitoringDefinition,
        buildRequirementResources({
          [RequirementKind.FlowCollector]: [undefined, false, undefined],
        }),
      );

      expect(capability.loaded).toBe(true);
    });
  });

  it('passes presentation fields through from the definition', () => {
    const capability = getObservabilityCapability(
      {
        ...monitoringDefinition,
        isAdvanced: true,
        requiredLabels: ['COO', 'MonitoringStack'],
        learnMoreUrl: 'https://docs.redhat.com/monitoring-ui-plugin',
      },
      buildRequirementResources(),
    );

    expect(capability.id).toEqual('monitoring');
    expect(capability.title).toEqual('Monitoring');
    expect(capability.isAdvanced).toBe(true);
    expect(capability.requiredLabels).toEqual(['COO', 'MonitoringStack']);
    expect(capability.learnMoreUrl).toEqual('https://docs.redhat.com/monitoring-ui-plugin');
  });

  describe('installing operators (Subscription)', () => {
    const lokiOperatorDefinition = {
      id: 'loki-operator',
      title: 'Loki Operator',
      operatorName: 'loki-operator',
      keywords: 'loki operator',
    };

    const loggingDefinition: CapabilityDefinition = {
      id: 'logging',
      title: 'Logging',
      description: 'Collect and forward logs across cluster workloads.',
      requiredOperators: [lokiOperatorDefinition],
      requiredConfigs: [],
    };

    const lokiSubscription: K8sResourceKind = {
      metadata: { name: 'loki-operator', namespace: 'openshift-operators' },
      spec: { startingCSV: 'loki-operator.v3.2.1' },
    };

    const lokiOperator = (capability: ReturnType<typeof getObservabilityCapability>) =>
      capability.requiredOperators.find((operator) => operator.id === 'loki-operator');

    const withInstallingSubscriptions = (
      subscriptions: K8sResourceKind[],
      csvs: K8sResourceKind[] = [],
    ) =>
      buildRequirementResources({
        [RequirementKind.ClusterServiceVersion]: [csvs, true, undefined],
        [RequirementKind.Subscription]: [
          getInstallingSubscriptions(subscriptions, csvs),
          true,
          undefined,
        ],
      });

    it('reports Degraded and attaches the subscription when install is in progress', () => {
      const capability = getObservabilityCapability(
        loggingDefinition,
        withInstallingSubscriptions([lokiSubscription]),
      );

      expect(lokiOperator(capability)?.status).toEqual(RequirementStatus.Degraded);
      expect(lokiOperator(capability)?.subscription).toEqual(lokiSubscription);
      expect(lokiOperator(capability)?.csv).toBeUndefined();
      expect(capability.status).toEqual(CapabilityStatus.Partial);
    });

    it('ignores subscriptions whose startingCSV targets a different package', () => {
      const capability = getObservabilityCapability(
        loggingDefinition,
        withInstallingSubscriptions([
          { ...lokiSubscription, spec: { startingCSV: 'tempo-operator.v1.0.0' } },
        ]),
      );

      expect(lokiOperator(capability)?.status).toEqual(RequirementStatus.Missing);
      expect(lokiOperator(capability)?.subscription).toBeUndefined();
      expect(capability.status).toEqual(CapabilityStatus.Available);
    });

    it('treats a succeeded CSV as installed when the subscription is no longer installing', () => {
      const lokiCSV: K8sResourceKind = {
        metadata: {
          name: 'loki-operator.v3.2.1',
          namespace: 'openshift-operators',
          labels: { 'operators.coreos.com/loki-operator.openshift-operators': '' },
        },
        status: { phase: 'Succeeded' },
      };

      const capability = getObservabilityCapability(
        loggingDefinition,
        withInstallingSubscriptions([lokiSubscription], [lokiCSV]),
      );

      expect(lokiOperator(capability)?.status).toEqual(RequirementStatus.Success);
      expect(lokiOperator(capability)?.csv).toEqual(lokiCSV);
      expect(lokiOperator(capability)?.subscription).toBeUndefined();
      expect(capability.status).toEqual(CapabilityStatus.Ready);
    });
  });
});
