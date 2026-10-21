import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import {
  Attribute,
  AttributeList,
  Filters,
  Option,
} from '@/features/logging/components/filters/filter-types';
import {
  getStreamLabelsFromSchema,
  ResourceLabel,
} from '@/features/logging/components/ParseResources';
import { cancellableFetch } from '@/features/logging/utils/cancellable-fetch';
import { LabelMatcher, LogQLQuery, PipelineStage } from '@/features/logging/utils/logql-query';
import { Config, Schema, SeriesResponse } from '@/features/logging/utils/logs-types';
import { executeLabelValue, executeSeries } from '@/features/logging/utils/loki-client';
import {
  Severity,
  severityAbbreviations,
  severityFromString,
} from '@/features/logging/utils/severity';
import {
  getInitialTenantFromNamespace,
  namespaceBelongsToInfrastructureTenant,
  notEmptyString,
  notUndefined,
  removeQuoteWrapper,
} from '@/features/logging/utils/value-utils';

const RESOURCES_ENDPOINT = '/api/kubernetes/api/v1';

type K8sResource = K8sResourceCommon & {
  spec?: { containers: Array<{ name: string }> };
};

type K8sResourceListResponse = {
  kind: string;
  apiVersion: string;
  metadata: {
    resourceVersion: string;
    continue: string;
    remainingItemCount: number;
  };
  items: Array<K8sResource>;
};

type ResourceOptionMapper = (resource: K8sResource) => Option | Array<Option>;
type ResourceOptionFilter = (resource: K8sResourceCommon) => boolean;

const resourceAbort: Record<string, null | (() => void)> = {};

const projectsDataSource =
  (filter?: ResourceOptionFilter) =>
  async (): Promise<Array<{ option: string; value: string }>> => {
    const { request, abort } = cancellableFetch<K8sResourceListResponse>(
      `/api/kubernetes/apis/project.openshift.io/v1/projects`,
    );

    if (resourceAbort.projects) {
      resourceAbort.projects();
    }

    resourceAbort.projects = abort;

    const response = await request();

    const filteredItems = filter ? response.items.filter(filter) : response.items;

    return filteredItems
      .map((project) => ({
        option: project?.metadata?.name ?? '',
        value: project?.metadata?.name ?? '',
      }))
      .filter(({ value }) => notEmptyString(value));
  };

const lokiLabelValuesDataSource =
  ({
    config,
    query,
    labelName,
    tenant,
  }: {
    config: Config;
    query?: string;
    labelName: string;
    tenant: string;
  }) =>
  async (): Promise<Array<{ option: string; value: string }>> => {
    const { abort, request } = executeLabelValue({ query, labelName, tenant, config });

    if (resourceAbort.lokiLabels) {
      resourceAbort.lokiLabels();
    }

    resourceAbort.lokiLabels = abort;

    const response = await request();

    const uniqueValues = new Set<string>(response.data);
    const sortedValues = Array.from(uniqueValues).sort();

    return sortedValues
      .map((label) => ({
        option: label,
        value: label,
      }))
      .filter(({ value }) => notEmptyString(value));
  };

const lokiSeriesDataSource =
  ({
    config,
    match,
    tenant,
    mapper,
  }: {
    config: Config;
    match: Array<string>;
    tenant: string;
    mapper: (data: SeriesResponse) => Array<{ option: string; value: string }>;
  }) =>
  async (): Promise<Array<{ option: string; value: string }>> => {
    const { abort, request } = executeSeries({
      match: match.filter(notEmptyString),
      tenant,
      config,
    });

    if (resourceAbort.lokiSeries) {
      resourceAbort.lokiSeries();
    }

    resourceAbort.lokiSeries = abort;

    const response = await request();

    return mapper(response).filter(({ value }) => notEmptyString(value));
  };

const resourceDataSource =
  ({
    resource,
    namespace,
    mapper = (resourceToMap) => ({
      option: resourceToMap?.metadata?.name ?? '',
      value: resourceToMap?.metadata?.name ?? '',
    }),
    filter,
  }: {
    resource: 'pods' | 'namespaces' | string;
    namespace?: string;
    mapper?: ResourceOptionMapper;
    filter?: ResourceOptionFilter;
  }) =>
  async (): Promise<Array<{ option: string; value: string }>> => {
    const endpoint = namespace
      ? `${RESOURCES_ENDPOINT}/namespaces/${namespace}/${resource}`
      : `${RESOURCES_ENDPOINT}/${resource}`;

    const { request, abort } = cancellableFetch<K8sResourceListResponse>(endpoint);

    const abortKey = namespace ? `${resource}-${namespace}` : resource;

    const abortFunction = resourceAbort[abortKey];
    if (abortFunction) {
      abortFunction();
    }

    resourceAbort[abortKey] = abort;

    const response = await request();

    const kind = response.kind;
    let listItems: Array<K8sResource> = [];

    switch (kind) {
      case 'Pod':
        listItems = [response];
        break;
      case 'NamespaceList':
      case 'PodList':
        listItems = response.items;
        break;
    }

    const filteredItems = filter ? listItems.filter(filter) : listItems;

    return filteredItems.flatMap(mapper).filter(({ value }) => notEmptyString(value));
  };

const getAttributeLabels = (schema: Schema) => {
  const labels = getStreamLabelsFromSchema(schema);
  const namespaceLabel = labels[ResourceLabel.Namespace];
  const podLabel = labels[ResourceLabel.Pod];
  const containerLabel = labels[ResourceLabel.Container];
  return { namespaceLabel, podLabel, containerLabel };
};

const getTenantNamespaceQuery = (tenant: string, namespaceLabel: string): string | undefined => {
  const infraPattern = 'openshift-.*|openshift|default|kube-.*';
  switch (tenant) {
    case 'infrastructure':
      return `${namespaceLabel}=~"${infraPattern}"`;
    case 'application':
      return `${namespaceLabel}!~"${infraPattern}"`;
    default:
      return undefined;
  }
};

const mergeSettledResults = (
  results: Array<PromiseSettledResult<Option[]>>,
  fallback: Option[] = [],
): Option[] => {
  const allRejected = results.length > 0 && results.every((r) => r.status === 'rejected');
  if (allRejected && fallback.length === 0) {
    throw (results[0] as PromiseRejectedResult).reason;
  }

  const uniqueValues = new Set<string>(fallback.map((option) => option.value));
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      result.value.forEach((option) => uniqueValues.add(option.value));
    }
  });
  return Array.from(uniqueValues)
    .sort()
    .map((v) => ({ option: v, value: v }));
};

const getNamespaceAttributeOptions = (
  tenant: string,
  config: Config,
  schema: Schema,
  seedNamespaces: string[] = [],
): (() => Promise<Option[]>) => {
  const { namespaceLabel } = getAttributeLabels(schema);

  const tenantFilter = (resource: K8sResourceCommon) => {
    switch (tenant) {
      case 'infrastructure':
        return namespaceBelongsToInfrastructureTenant(resource.metadata?.name || '');
      case 'application':
        return !namespaceBelongsToInfrastructureTenant(resource.metadata?.name || '');
    }
    return true;
  };

  const lokiTenantFilter = (namespace: string) => {
    switch (tenant) {
      case 'infrastructure':
        return namespaceBelongsToInfrastructureTenant(namespace);
      case 'application':
        return !namespaceBelongsToInfrastructureTenant(namespace);
    }
    return true;
  };

  return async () => {
    const filteredProjectList = projectsDataSource(tenantFilter)();
    const filteredLokiNamespaceList = lokiLabelValuesDataSource({
      config,
      tenant,
      labelName: namespaceLabel,
    })().then((options) => options.filter((opt) => lokiTenantFilter(opt.value)));

    const seeded = seedNamespaces
      .filter((namespace) => lokiTenantFilter(namespace))
      .map((namespace) => ({ option: namespace, value: namespace }));

    const settled = await Promise.allSettled<Option[]>([
      filteredProjectList,
      filteredLokiNamespaceList,
    ]);

    return mergeSettledResults(settled, seeded);
  };
};

// The logs-page and the logs-dev-page both need a default set of attributes to pass
// to queryFromFilters and filtersFromQuery which only need id and label
export const initialAvailableAttributes = (schema: Schema): AttributeList => {
  const labels = getStreamLabelsFromSchema(schema);
  const namespaceLabel = labels[ResourceLabel.Namespace];
  const podLabel = labels[ResourceLabel.Pod];
  const containerLabel = labels[ResourceLabel.Container];

  return [
    {
      name: 'Namespaces',
      label: namespaceLabel,
      id: 'namespace',
      valueType: 'checkbox-select',
    },
    {
      name: 'Pods',
      label: podLabel,
      id: 'pod',
      valueType: 'checkbox-select',
    },
    {
      name: 'Containers',
      label: containerLabel,
      id: 'container',
      valueType: 'checkbox-select',
    },
  ];
};

export const availableAttributes = ({
  tenant,
  config,
  schema,
  t,
}: {
  tenant: string;
  config: Config;
  schema: Schema;
  t: (key: string) => string;
}): AttributeList => {
  const { namespaceLabel, podLabel, containerLabel } = getAttributeLabels(schema);

  const contentAttribute: Attribute = {
    name: 'Content',
    id: 'content',
    valueType: 'text',
  };

  // When tenant is audit, only the content attribute is available
  if (tenant === 'audit') {
    return [contentAttribute];
  }

  return [
    contentAttribute,
    {
      name: 'Namespaces',
      label: namespaceLabel,
      id: 'namespace',
      options: getNamespaceAttributeOptions(tenant, config, schema),
      valueType: 'checkbox-select',
      emptyStateMessage: t('No namespaces found'),
    },
    {
      name: 'Pods',
      label: podLabel,
      id: 'pod',
      options: (filters) => {
        const selectedNamespaces = filters?.namespace ? Array.from(filters.namespace) : undefined;

        return getPodAttributeOptions(tenant, config, schema, selectedNamespaces)();
      },
      valueType: 'checkbox-select',
      emptyStateMessage: (filters) => {
        const selectedNamespaces = filters?.namespace ? Array.from(filters.namespace) : undefined;
        if (selectedNamespaces && selectedNamespaces.length > 0) {
          return t('No pods found in the selected namespace(s)');
        }
        return t('No pods found');
      },
    },
    {
      name: 'Containers',
      label: containerLabel,
      id: 'container',
      options: (filters) => {
        const selectedNamespaces = filters?.namespace ? Array.from(filters.namespace) : undefined;

        return getContainerAttributeOptions(tenant, config, schema, selectedNamespaces)();
      },
      expandSelection: (selections) => {
        const podSelections = new Set<string>();
        const containerSelections = new Set<string>();

        for (const container of selections.values()) {
          if (container.includes(' / ')) {
            const [pod, containerName] = container.split(' / ');
            podSelections.add(pod);
            containerSelections.add(containerName);
          } else {
            containerSelections.add(container);
          }
        }

        return new Map([
          ['pod', podSelections],
          ['container', containerSelections],
        ]);
      },
      isItemSelected: (value, filters) => {
        if (!value.includes('/')) {
          return filters?.container?.has(value) ?? false;
        }

        const parts = value.split(' / ');
        if (parts.length !== 2) {
          return false;
        }

        const [pod, container] = parts;

        if (
          (!filters.pod || filters.pod.size === 0) &&
          filters.container &&
          filters.container.size > 0
        ) {
          return filters.container.has(container);
        }

        if (
          !filters.pod ||
          filters.pod.size === 0 ||
          !filters.container ||
          filters.container.size === 0
        ) {
          return false;
        }

        return filters.pod.has(pod) && filters.container.has(container);
      },
      valueType: 'checkbox-select',
      emptyStateMessage: (filters) => {
        const selectedNamespaces = filters?.namespace ? Array.from(filters.namespace) : undefined;
        if (selectedNamespaces && selectedNamespaces.length > 0) {
          return t('No containers found in the selected namespace(s)');
        }
        return t('No containers found');
      },
    },
  ];
};

export const availableDevConsoleAttributes = (
  tenant: string,
  config: Config,
  schema: Schema,
  namespace?: string,
): AttributeList => {
  const { namespaceLabel, podLabel, containerLabel } = getAttributeLabels(schema);

  const contentAttribute: Attribute = {
    name: 'Content',
    id: 'content',
    valueType: 'text',
  };

  // When tenant is audit, only the content attribute is available
  if (tenant === 'audit') {
    return [contentAttribute];
  }

  const lokiNamespaceQuery = namespace ? `{ ${namespaceLabel}="${namespace}" }` : undefined;

  return [
    contentAttribute,
    {
      name: 'Namespaces',
      label: namespaceLabel,
      id: 'namespace',
      // Fine-grained log access is independent of project ownership, so union the
      // projects list with Loki's namespaces and seed the active namespace for
      // users who can enumerate neither.
      options: getNamespaceAttributeOptions(tenant, config, schema, namespace ? [namespace] : []),
      valueType: 'checkbox-select',
    },
    {
      name: 'Pods',
      label: podLabel,
      id: 'pod',
      options: () => {
        const sources: Array<Promise<Option[]>> = [
          lokiLabelValuesDataSource({
            config,
            tenant,
            labelName: podLabel,
            query: lokiNamespaceQuery,
          })(),
        ];
        if (namespace) {
          sources.push(resourceDataSource({ resource: 'pods', namespace })());
        }
        return Promise.allSettled(sources).then(mergeSettledResults);
      },
      valueType: 'checkbox-select',
    },
    {
      name: 'Containers',
      label: containerLabel,
      id: 'container',
      options: () => {
        const sources: Array<Promise<Option[]>> = [
          lokiLabelValuesDataSource({
            config,
            tenant,
            labelName: containerLabel,
            query: lokiNamespaceQuery,
          })(),
        ];
        if (namespace) {
          sources.push(
            resourceDataSource({
              resource: 'pods',
              namespace,
              mapper: (resource) =>
                resource?.spec?.containers.map((c) => ({
                  option: c.name,
                  value: c.name,
                })) ?? [],
            })(),
          );
        }
        return Promise.allSettled(sources).then(mergeSettledResults);
      },
      valueType: 'checkbox-select',
    },
  ];
};

export const availablePodAttributes = (
  namespace: string,
  podId: string,
  config: Config,
  schema: Schema,
): AttributeList => {
  const streamLabels = getStreamLabelsFromSchema(schema);
  const namespaceLabel = streamLabels[ResourceLabel.Namespace];
  const podLabel = streamLabels[ResourceLabel.Pod];
  const containerLabel = streamLabels[ResourceLabel.Container];

  return [
    {
      name: 'Content',
      id: 'content',
      valueType: 'text',
    },
    {
      name: 'Pods',
      label: podLabel,
      id: 'pod',
      options: lokiLabelValuesDataSource({
        config,
        query: `{ ${namespaceLabel}="${namespace}" }`,
        labelName: podLabel,
        tenant: getInitialTenantFromNamespace(namespace),
      }),
      valueType: 'checkbox-select',
    },
    {
      name: 'Containers',
      label: containerLabel,
      id: 'container',
      options: lokiLabelValuesDataSource({
        config,
        query: `{ ${podLabel}="${podId}" }`,
        labelName: containerLabel,
        tenant: getInitialTenantFromNamespace(namespace),
      }),
      valueType: 'checkbox-select',
    },
  ];
};

export const queryFromFilters = ({
  existingQuery,
  filters,
  attributes,
  tenant,
  schema,
}: {
  existingQuery: string;
  filters?: Filters;
  attributes: AttributeList;
  tenant?: string;
  schema: Schema;
}): string => {
  const query = new LogQLQuery(existingQuery);

  const streamLabels = getStreamLabelsFromSchema(schema);
  const tenantLabel = streamLabels[ResourceLabel.LogType];
  const severityLabel = streamLabels[ResourceLabel.Severity];

  if (!filters) {
    return query.toString();
  }

  if (tenant) {
    query.addSelectorMatcher({
      label: tenantLabel,
      operator: '=',
      value: `"${tenant}"`,
    });
  }

  const contentPipelineStage = getContentPipelineStage(filters);

  if (contentPipelineStage) {
    query.removePipelineStage({ operator: '|=' }).addPipelineStage(contentPipelineStage, {
      placement: 'start',
    });
  }

  if (filters?.content === undefined || filters.content.size === 0) {
    query.removePipelineStage({ operator: '|=' });
  }

  const severityPipelineStage = getSeverityFilterPipelineStage({ filters, schema });

  if (severityPipelineStage) {
    query
      .removePipelineStage({}, { matchLabel: `${severityLabel}` })
      .addPipelineStage(severityPipelineStage, {
        placement: 'end',
      });
  }

  if (filters?.severity === undefined || filters.severity.size === 0) {
    query.removePipelineStage({}, { matchLabel: `${severityLabel}` });
  }

  query.addSelectorMatcher(getMatchersFromFilters({ filters, schema }));

  attributes.forEach(({ id, label }) => {
    if (label) {
      const filterValue = filters?.[id];
      if (filterValue === undefined || filterValue.size === 0) {
        query.removeSelectorMatcher({ label });
      }
    }
  });

  // Remove the tenant label matcher if the query has other selectors
  if (tenant && query.streamSelector.filter((a) => a.label !== tenantLabel).length > 0) {
    query.removeSelectorMatcher({ label: tenantLabel });
  }

  if (schema === Schema.viaq) {
    query.addPipelineStage({ operator: '|', value: 'json' }, { placement: 'start' });
  }

  return query.toString();
};

export const filtersFromQuery = ({
  query,
  attributes,
  schema,
}: {
  query?: string;
  attributes: AttributeList;
  schema: Schema.viaq | Schema.otel;
}): Filters => {
  const filters: Filters = {};
  const logQLQuery = new LogQLQuery(query ?? '');

  const streamLabels = getStreamLabelsFromSchema(schema);
  const severityLabel = streamLabels[ResourceLabel.Severity];

  for (const { label, id } of attributes) {
    if (label && label.length > 0) {
      for (const selector of logQLQuery.streamSelector) {
        if (selector.label === label && selector.value) {
          filters[id] = new Set(removeQuoteWrapper(selector.value).split('|'));
        }
      }
    }
  }

  for (const pipelineStage of logQLQuery.pipeline) {
    if (
      pipelineStage.operator === '|' &&
      pipelineStage.labelsInFilter?.every(({ label }) => label === `${severityLabel}`) &&
      !filters.severity
    ) {
      const severityValues: Array<Severity> = pipelineStage.labelsInFilter
        .map(({ value }) => (value ? removeQuoteWrapper(value) : ''))
        .flatMap((value) => value.split('|'))
        .map(severityFromString)
        .filter(notUndefined);
      if (severityValues.length > 0) {
        filters.severity = new Set(severityValues);
      }
    } else if (pipelineStage.operator === '|=' && !filters.content) {
      filters.content = new Set([removeQuoteWrapper(pipelineStage.value)]);
    }
  }

  return filters;
};

export const getNamespaceMatcher = ({
  namespace,
  schema,
}: {
  namespace?: string;
  schema: Schema;
}): LabelMatcher | undefined => {
  if (namespace === undefined) {
    return undefined;
  }

  const streamLabels = getStreamLabelsFromSchema(schema);
  const namespaceLabel = streamLabels[ResourceLabel.Namespace];

  return {
    label: namespaceLabel,
    operator: '=',
    value: `"${namespace}"`,
  };
};

const isK8sValueARegex = (value: string) => {
  // Regex to test if a string contains a regex matching a k8s name value
  const testRegex = /[{}()[\]^$*+?|/\\]|\.[*+?]/;
  return testRegex.test(value);
};

export const queryWithNamespace = ({
  query,
  namespace,
  schema,
}: {
  query: string;
  namespace?: string;
  schema: Schema;
}) => {
  const logQLQuery = new LogQLQuery(query ?? '');

  logQLQuery.addSelectorMatcher(getNamespaceMatcher({ namespace, schema }));

  return logQLQuery.toString();
};

export const getK8sMatcherFromSet = (
  label: string,
  values: Set<string>,
): LabelMatcher | undefined => {
  const valuesArray = Array.from(values);
  if (valuesArray.length === 0) {
    return undefined;
  }

  if (valuesArray.length === 1) {
    const value = valuesArray[0];

    return {
      label,
      operator: isK8sValueARegex(value) ? '=~' : '=',
      value: `"${value}"`,
    };
  }

  return {
    label,
    operator: '=~',
    value: `"${valuesArray.join('|')}"`,
  };
};

export const getMatchersFromFilters = ({
  filters,
  schema,
}: {
  filters?: Filters;
  schema: Schema;
}): Array<LabelMatcher> => {
  if (!filters) {
    return [];
  }

  const matchers: Array<LabelMatcher | undefined> = [];
  const labels = getStreamLabelsFromSchema(schema);
  const namespaceLabel = labels[ResourceLabel.Namespace];
  const podLabel = labels[ResourceLabel.Pod];
  const containerLabel = labels[ResourceLabel.Container];

  for (const key of Object.keys(filters)) {
    const value = filters[key];
    if (value) {
      switch (key) {
        case 'namespace':
          matchers.push(getK8sMatcherFromSet(namespaceLabel, value));
          break;
        case 'pod':
          matchers.push(getK8sMatcherFromSet(podLabel, value));
          break;
        case 'container':
          matchers.push(getK8sMatcherFromSet(containerLabel, value));
          break;
      }
    }
  }

  return matchers.filter(notUndefined);
};

export const getContentPipelineStage = (filters?: Filters): PipelineStage | undefined => {
  if (!filters) {
    return undefined;
  }

  const content = filters.content;

  if (!content) {
    return undefined;
  }

  const [textValue] = content;

  if (textValue === undefined) {
    return undefined;
  }

  return { operator: '|=', value: `\`${textValue}\`` };
};

export const getSeverityFilterPipelineStage = ({
  filters,
  schema,
}: {
  filters?: Filters;
  schema: Schema;
}): PipelineStage | undefined => {
  if (!filters) {
    return undefined;
  }

  const severity = filters.severity;

  const labels = getStreamLabelsFromSchema(schema);
  const severityLabel = labels.Severity;

  if (!severity) {
    return undefined;
  }

  const unknownFilter = severity.has('unknown')
    ? `${severityLabel}="unknown" or ${severityLabel}=""`
    : '';

  const severityFilters = Array.from(severity).flatMap((group: string | undefined) => {
    if (group === 'unknown' || group === undefined) {
      return [];
    }

    return severityAbbreviations[group as Severity];
  });

  const levelsfilter =
    severityFilters.length > 0 ? `${severityLabel}=~"${severityFilters.join('|')}"` : '';

  const allFilters = [unknownFilter, levelsfilter].filter(notEmptyString);

  return allFilters.length > 0 ? { operator: '|', value: allFilters.join(' or ') } : undefined;
};

const getPodAttributeOptions = (
  tenant: string,
  config: Config,
  schema: Schema,
  namespaces?: Array<string>,
): (() => Promise<Option[]>) => {
  const { podLabel } = getAttributeLabels(schema);

  const namespacedPodsResources: Array<Promise<Option[]>> = [];

  // get pods in selected namespaces for users that have restricted access
  for (const ns of namespaces || []) {
    namespacedPodsResources.push(resourceDataSource({ resource: 'pods', namespace: ns })());
  }

  const namespaceLabel = getStreamLabelsFromSchema(schema).Namespace;
  const namespacesQuery =
    namespaces && namespaces.length > 0
      ? `${namespaceLabel}=~"${namespaces.join('|')}"`
      : (getTenantNamespaceQuery(tenant, namespaceLabel) ?? '');

  const podResource =
    namespaces && namespaces.length > 0
      ? namespacedPodsResources
      : [
          resourceDataSource({
            resource: 'pods',
            filter: (resource) => {
              switch (tenant) {
                case 'infrastructure':
                  return namespaceBelongsToInfrastructureTenant(resource.metadata?.namespace || '');
                case 'application':
                  return !namespaceBelongsToInfrastructureTenant(
                    resource.metadata?.namespace || '',
                  );
              }

              return true;
            },
          })(),
        ];

  return () =>
    Promise.allSettled<Promise<Option[]>>([
      lokiLabelValuesDataSource({
        config,
        tenant,
        labelName: podLabel,
        query: namespacesQuery ? `{ ${namespacesQuery} }` : undefined,
      })(),
      ...podResource,
    ]).then(mergeSettledResults);
};

const getContainerAttributeOptions = (
  tenant: string,
  config: Config,
  schema: Schema,
  namespaces?: Array<string>,
): (() => Promise<Option[]>) => {
  const { containerLabel, podLabel } = getAttributeLabels(schema);

  const namespacedPodsResources: Array<Promise<Option[]>> = [];

  // get containers in selected namespaces for users that have restricted access
  for (const ns of namespaces || []) {
    namespacedPodsResources.push(
      resourceDataSource({
        resource: 'pods',
        namespace: ns,
        mapper: (resource) =>
          resource?.spec?.containers.map((container) => ({
            option: `${resource?.metadata?.name} / ${container.name}`,
            value: `${resource?.metadata?.name} / ${container.name}`,
          })) ?? [],
      })(),
    );
  }

  const namespaceLabel = getStreamLabelsFromSchema(schema).Namespace;
  const namespacesQuery =
    namespaces && namespaces.length > 0
      ? `${namespaceLabel}=~"${namespaces.join('|')}"`
      : (getTenantNamespaceQuery(tenant, namespaceLabel) ?? '');

  const seriesQuery = namespacesQuery
    ? `{ ${containerLabel}!="", ${podLabel}!="", ${namespacesQuery} }`
    : `{ ${containerLabel}!="", ${podLabel}!="" }`;

  const podResource =
    namespaces && namespaces.length > 0
      ? namespacedPodsResources
      : [
          resourceDataSource({
            resource: 'pods',
            filter: (resource) => {
              switch (tenant) {
                case 'infrastructure':
                  return namespaceBelongsToInfrastructureTenant(resource.metadata?.namespace || '');
                case 'application':
                  return !namespaceBelongsToInfrastructureTenant(
                    resource.metadata?.namespace || '',
                  );
              }

              return true;
            },
            mapper: (resource) =>
              resource?.spec?.containers.map((container) => ({
                option: `${resource?.metadata?.name} / ${container.name}`,
                value: `${resource?.metadata?.name} / ${container.name}`,
              })) ?? [],
          })(),
        ];

  return () =>
    Promise.allSettled<Promise<Option[]>>([
      lokiSeriesDataSource({
        config,
        tenant,
        match: [seriesQuery],
        mapper: (response) => {
          const uniqueContainers = new Set<string>();

          response.data.forEach((item) => {
            if (item[containerLabel] && item[podLabel]) {
              uniqueContainers.add(`${item[podLabel]} / ${item[containerLabel]}`);
            }
          });

          return Array.from(uniqueContainers).map((container) => ({
            option: container,
            value: container,
          }));
        },
      })(),
      ...podResource,
    ]).then(mergeSettledResults);
};
