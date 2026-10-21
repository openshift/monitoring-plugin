vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  consoleFetchJSON: vi.fn(),
  K8sResourceCommon: {},
}));

import {
  filtersFromQuery,
  getContentPipelineStage,
  getK8sMatcherFromSet,
  getMatchersFromFilters,
  getNamespaceMatcher,
  getSeverityFilterPipelineStage,
  queryFromFilters,
} from '@/features/logging/components/AttributeFilters';
import { AttributeList, Filters } from '@/features/logging/components/filters/filter-types';
import {
  getStreamLabelsFromSchema,
  ResourceLabel,
} from '@/features/logging/components/ParseResources';
import { LabelMatcher, PipelineStage } from '@/features/logging/utils/logql-query';
import { Schema } from '@/features/logging/utils/logs-types';

const availableAttributes = (schema: Schema): AttributeList => {
  const labelMatchers = getStreamLabelsFromSchema(schema);
  const namespaceLabel = labelMatchers[ResourceLabel.Namespace];
  const podLabel = labelMatchers[ResourceLabel.Pod];
  const containerLabel = labelMatchers[ResourceLabel.Container];

  return [
    {
      name: 'Content',
      id: 'content',
      valueType: 'text',
    },
    {
      name: 'Namespaces',
      label: namespaceLabel,
      id: 'namespace',
      options: () =>
        Promise.resolve([
          { option: 'Namespace 1', value: 'namespace-1' },
          { option: 'Namespace 2', value: 'namespace-2' },
        ]),
      valueType: 'checkbox-select',
    },
    {
      name: 'Pods',
      label: podLabel,
      id: 'pod',
      options: () =>
        Promise.resolve([
          { option: 'Pod 1', value: 'pod-1' },
          { option: 'Pod 2', value: 'pod-2' },
        ]),
      valueType: 'checkbox-select',
    },
    {
      name: 'Containers',
      label: containerLabel,
      id: 'container',
      options: () =>
        Promise.resolve([
          { option: 'Container 1', value: 'container-1' },
          { value: 'container-2', option: 'Container 2' },
        ]),
      valueType: 'checkbox-select',
    },
  ];
};

describe('Attribute filters', () => {
  it('should return matchers from filters', () => {
    [
      {
        filters: {},
        expected: [],
      },
      {
        filters: {
          namespace: new Set(['my-namespace', 'other-namespace']),
        },
        expected: [
          {
            label: 'kubernetes_namespace_name',
            operator: '=~',
            value: '"my-namespace|other-namespace"',
          },
        ],
      },
      {
        filters: {
          namespace: new Set(['my-namespace', 'other-namespace']),
          pod: new Set(['pod-1', 'pod-2']),
          container: new Set(['container-1', 'container-2']),
        },
        expected: [
          {
            label: 'kubernetes_namespace_name',
            operator: '=~',
            value: '"my-namespace|other-namespace"',
          },
          {
            label: 'kubernetes_pod_name',
            operator: '=~',
            value: '"pod-1|pod-2"',
          },
          {
            label: 'kubernetes_container_name',
            operator: '=~',
            value: '"container-1|container-2"',
          },
        ],
      },
      {
        filters: {
          namespace: new Set(['my-namespace', 'other-namespace']),
          pod: new Set(['pod-1', 'pod-2']),
          container: new Set(['container-1', 'container-2']),
        },
        schema: Schema.otel,
        expected: [
          {
            label: 'k8s_namespace_name',
            operator: '=~',
            value: '"my-namespace|other-namespace"',
          },
          {
            label: 'k8s_pod_name',
            operator: '=~',
            value: '"pod-1|pod-2"',
          },
          {
            label: 'k8s_container_name',
            operator: '=~',
            value: '"container-1|container-2"',
          },
        ],
      },
    ].forEach(
      ({
        filters,
        expected,
        schema,
      }: {
        filters: Filters;
        expected: LabelMatcher[];
        schema?: Schema;
      }) => {
        const matchers = getMatchersFromFilters({ filters, schema: schema ?? Schema.viaq });
        expect(matchers).toEqual(expected);
      },
    );
  });

  it('should get content pipeline stage from filters', () => {
    [
      {
        filters: {},
        expected: undefined,
      },
      {
        filters: {
          content: new Set(['my search query']),
        },
        expected: { operator: '|=', value: '`my search query`' },
      },
    ].forEach(({ filters, expected }) => {
      const pipeline = getContentPipelineStage(filters);
      expect(pipeline).toEqual(expected);
    });
  });

  test('getSelectorFromSet', () => {
    [
      {
        label: 'test',
        set: new Set<string>(),
        expected: undefined,
      },
      {
        label: 'test',
        set: new Set<string>(['']),
        expected: { label: 'test', operator: '=', value: '""' },
      },
      {
        label: 'test',
        set: new Set(['value']),
        expected: { label: 'test', operator: '=', value: '"value"' },
      },
      {
        label: 'test',
        set: new Set(['value-1', 'value-2']),
        expected: { label: 'test', operator: '=~', value: '"value-1|value-2"' },
      },
    ].forEach(({ set, label, expected }) => {
      const selectors = getK8sMatcherFromSet(label, set);
      expect(selectors).toEqual(expected);
    });
  });

  test('getNamespaceStreamSelector', () => {
    [
      {
        namespace: 'my-namespace',
        expected: {
          label: 'kubernetes_namespace_name',
          operator: '=',
          value: '"my-namespace"',
        },
      },
      {
        namespace: '',
        expected: {
          label: 'kubernetes_namespace_name',
          operator: '=',
          value: '""',
        },
      },
      {
        namespace: 'otel-namespace',
        schema: Schema.otel,
        expected: {
          label: 'k8s_namespace_name',
          operator: '=',
          value: '"otel-namespace"',
        },
      },
      {
        namespace: undefined,
        expected: undefined,
      },
    ].forEach(
      ({
        namespace,
        expected,
        schema,
      }: {
        namespace: string | undefined;
        expected: LabelMatcher | undefined;
        schema?: Schema;
      }) => {
        const selectors = getNamespaceMatcher({ namespace, schema: schema ?? Schema.viaq });
        expect(selectors).toEqual(expected);
      },
    );
  });

  test('getSeverityFilterPipeline', () => {
    [
      {
        filters: undefined,
        expected: undefined,
      },
      {
        filters: {},
        expected: undefined,
      },
      {
        filters: { severity: undefined },
        expected: undefined,
      },
      {
        filters: {
          severity: new Set(['error']),
        },
        expected: { operator: '|', value: 'level=~"error|err|eror"' },
      },
      {
        filters: {
          severity: new Set(['error', 'info']),
        },
        expected: {
          operator: '|',
          value: 'level=~"error|err|eror|info|inf|information|notice"',
        },
      },
      {
        filters: {
          severity: new Set(['error', 'info', 'unknown']),
        },
        expected: {
          operator: '|',
          value:
            'level="unknown" or level="" or level=~"error|err|eror|info|inf|information|notice"',
        },
      },
      {
        filters: {
          severity: new Set(['error', 'info', 'unknown']),
        },
        schema: Schema.otel,
        expected: {
          operator: '|',
          value:
            'severity_text="unknown" or severity_text="" or severity_text=~"error|err|eror|info|inf|information|notice"',
        },
      },
      {
        filters: {
          severity: new Set(['unknown']),
        },
        expected: {
          operator: '|',
          value: 'level="unknown" or level=""',
        },
      },
    ].forEach(
      ({
        filters,
        expected,
        schema,
      }: {
        filters: Filters | undefined;
        expected: PipelineStage | undefined;
        schema?: Schema;
      }) => {
        const pipeline = getSeverityFilterPipelineStage({ filters, schema: schema ?? Schema.viaq });
        expect(pipeline).toEqual(expected);
      },
    );
  });

  test('filtersFromQuery', () => {
    [
      {
        query: undefined,
        expectedFilters: {},
      },
      {
        query: '{',
        expectedFilters: {},
      },
      {
        query: '{ foo="var" }',
        expectedFilters: {},
      },
      {
        query: '{ kubernetes_pod_name }',
        expectedFilters: {},
      },
      {
        query: '{ kubernetes_pod_name= }',
        expectedFilters: {},
      },
      {
        query: '{ kubernetes_pod_name=" }',
        expectedFilters: {},
      },
      {
        query: '{ kubernetes_pod_name="a-pod }',
        expectedFilters: {},
      },
      {
        query: '{ kubernetes_pod_name="a-pod" }',
        expectedFilters: { pod: new Set(['a-pod']) },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        expectedFilters: { pod: new Set(['a-pod', 'b-pod']) },
      },
      {
        query: '{ kubernetes_pod_name=~`a-pod|b-pod` }',
        expectedFilters: { pod: new Set(['a-pod', 'b-pod']) },
      },
      {
        query:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test" } |=`some line content` | other="filter" | level="inf"',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          content: new Set([`some line content`]),
          severity: new Set(['info']),
        },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod", ',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
        },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod" } |',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
        },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod" } |=',
        expectedFilters: {
          content: new Set(['']),
          pod: new Set(['a-pod', 'b-pod']),
        },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod" } |=`some line',
        expectedFilters: {
          content: new Set(['']),
          pod: new Set(['a-pod', 'b-pod']),
        },
      },
      {
        query: '{ kubernetes_pod_name=~"a-pod|b-pod" } |=`some line` |',
        expectedFilters: {
          content: new Set([`some line`]),
          pod: new Set(['a-pod', 'b-pod']),
        },
      },
      {
        query:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |=`some line content` | other="filter" | level="err|eror" or level="unknown" or level=""',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`some line content`]),
          severity: new Set(['error', 'unknown']),
        },
      },
      {
        query:
          '{ k8s_pod_name=~"a-pod|b-pod", k8s_namespace_name=~"ns-1|ns-2", label="test", k8s_container_name="container-1" } |=`some line content` | other="filter" | severity_text="err|eror" or severity_text="unknown" or severity_text=""',
        schema: Schema.otel,
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`some line content`]),
          severity: new Set(['error', 'unknown']),
        },
      },
      {
        query:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |=`some line content` | other="filter" | level',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`some line content`]),
        },
      },
      {
        query:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |=`"some line content"` | other="filter" | level',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`"some line content"`]),
        },
      },
      {
        query:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |=`"some-line-content"` | other="filter" | level',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`"some-line-content"`]),
        },
      },
      {
        query:
          '{ k8s_pod_name=~"a-pod|b-pod", k8s_namespace_name=~"ns-1|ns-2", label="test", k8s_container_name="container-1" } |=`"some-line-content"` | other="filter" | level',
        expectedFilters: {
          pod: new Set(['a-pod', 'b-pod']),
          namespace: new Set(['ns-1', 'ns-2']),
          container: new Set(['container-1']),
          content: new Set([`"some-line-content"`]),
        },
        schema: Schema.otel,
      },
    ].forEach(
      ({
        query,
        expectedFilters,
        schema,
      }: {
        query: string | undefined;
        expectedFilters: Filters;
        schema?: Schema;
      }) => {
        const filters = filtersFromQuery({
          query,
          attributes: availableAttributes(schema ?? Schema.viaq),
          schema: schema ?? Schema.viaq,
        });
        expect(filters).toEqual(expectedFilters);
      },
    );
  });

  test('query from filters', () => {
    [
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        // If a regex is provided as a value, the operator must be =~
        filters: {
          pod: new Set(['.*etcd.*']),
        },
        expectedQuery: '{ kubernetes_pod_name=~".*etcd.*" } | json',
      },
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        // Single dots are not considered regex as they are valid DNS names:
        // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
        filters: {
          pod: new Set(['openshift.pod']),
        },
        expectedQuery: '{ kubernetes_pod_name="openshift.pod" } | json',
      },
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" } | json',
        // A regex including a dot must have a quantifier (* or + or ?)
        // as regex match in LogQL is fully anchored
        // https://grafana.com/docs/loki/latest/query/log_queries/#log-stream-selector
        filters: {
          pod: new Set(['openshift.*pod']),
        },
        expectedQuery: '{ kubernetes_pod_name=~"openshift.*pod" } | json',
      },
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        // A regex including a dot must have a quantifier (* or + or ?)
        // as regex match in LogQL is fully anchored
        // https://grafana.com/docs/loki/latest/query/log_queries/#log-stream-selector
        filters: {
          pod: new Set(['openshift.+pod']),
        },
        expectedQuery: '{ kubernetes_pod_name=~"openshift.+pod" } | json',
      },
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        // A regex including a dot must have a quantifier (* or + or ?)
        // as regex match in LogQL is fully anchored
        // https://grafana.com/docs/loki/latest/query/log_queries/#log-stream-selector
        filters: {
          pod: new Set(['openshift.?pod']),
        },
        expectedQuery: '{ kubernetes_pod_name=~"openshift.?pod" } | json',
      },
      {
        initialQuery: '{ kubernetes_pod_name=~"a-pod|b-pod" }',
        filters: {
          pod: new Set(['ns-1']),
        },
        expectedQuery: '{ kubernetes_pod_name="ns-1" } | json',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level="err|eror" or level="unknown" or level=""',
        filters: undefined,
        expectedQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |= "some line content" | other="filter" | level="err|eror" or level="unknown" or level=""',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~`a-pod|b-pod`, kubernetes_namespace_name=~`ns-1|ns-2`, label=`test`, kubernetes_container_name=`container-1` } |=`some line content` | other=`filter` | level=`err|eror` or level=`unknown` or level=``',
        filters: undefined,
        expectedQuery:
          '{ kubernetes_pod_name=~`a-pod|b-pod`, kubernetes_namespace_name=~`ns-1|ns-2`, label=`test`, kubernetes_container_name=`container-1` } |= `some line content` | other=`filter` | level=`err|eror` or level=`unknown` or level=``',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } | json |="some line content" | other="filter" | level="err|eror" or level="unknown" or level=""',
        filters: {},
        expectedQuery: '{ label="test" } | json | other="filter"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } | json |="some line content" | other="filter" | level="err|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3']),
        },
        expectedQuery:
          '{ kubernetes_namespace_name="namespace-3", label="test" } | json | other="filter"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } | json |="some line content" | other="filter" | level="err|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          severity: new Set(['unknown', 'error']),
        },
        expectedQuery:
          '{ kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } | json | other="filter" | level="unknown" or level="" or level=~"error|err|eror"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" |  level="unknown" or level="" or level=~"err|error|eror"',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set(['new line filter']),
          severity: new Set(['error', 'unknown']),
        },
        expectedQuery:
          '{ kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } |= `new line filter` | json | other="filter" | level="unknown" or level="" or level=~"error|err|eror"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set(['new line filter']),
          severity: new Set(['error']),
        },
        expectedQuery:
          '{ kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } |= `new line filter` | json | other="filter" | level=~"error|err|eror"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set(['new line filter']),
          severity: new Set(['error', 'info']),
          pod: new Set(['some-pod']),
        },
        expectedQuery:
          '{ kubernetes_pod_name="some-pod", kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } |= `new line filter` | json | other="filter" | level=~"error|err|eror|info|inf|information|notice"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set(['new line filter']),
          severity: new Set<string>(),
          pod: new Set(['some-pod']),
        },
        expectedQuery:
          '{ kubernetes_pod_name="some-pod", kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } |= `new line filter` | json | other="filter"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set<string>(),
          severity: new Set<string>(),
          pod: new Set(['some-pod']),
        },
        expectedQuery:
          '{ kubernetes_pod_name="some-pod", kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } | json | other="filter"',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set<string>(),
          severity: new Set<string>(),
          pod: new Set<string>(),
        },
        expectedQuery:
          '{ kubernetes_namespace_name=~"namespace-3|namespace-4", label="test" } | json | other="filter"',
      },
      // Add otel labels keeping the viaq labels
      {
        initialQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1" } |="some line content" | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set<string>(),
          severity: new Set<string>(),
          pod: new Set<string>(),
        },
        schema: Schema.otel,
        expectedQuery:
          '{ kubernetes_pod_name=~"a-pod|b-pod", kubernetes_namespace_name=~"ns-1|ns-2", label="test", kubernetes_container_name="container-1", k8s_namespace_name=~"namespace-3|namespace-4" } | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
      },
      {
        initialQuery:
          '{ kubernetes_pod_name=~`a-pod|b-pod`, kubernetes_namespace_name=~`ns-1|ns-2`, label=`test`, kubernetes_container_name=`container-1` } |=`some line content` | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
        filters: {
          namespace: new Set(['namespace-3', 'namespace-4']),
          content: new Set<string>(),
          severity: new Set<string>(),
          pod: new Set<string>(),
        },
        schema: Schema.otel,
        expectedQuery:
          '{ kubernetes_pod_name=~`a-pod|b-pod`, kubernetes_namespace_name=~`ns-1|ns-2`, label=`test`, kubernetes_container_name=`container-1`, k8s_namespace_name=~"namespace-3|namespace-4" } | other="filter" | level=~"err|error|eror" or level="unknown" or level=""',
      },
    ].forEach(
      ({
        initialQuery,
        filters,
        expectedQuery,
        schema,
      }: {
        initialQuery: string;
        filters?: Filters;
        expectedQuery: string;
        schema?: Schema;
      }) => {
        expect(
          queryFromFilters({
            existingQuery: initialQuery,
            filters,
            attributes: availableAttributes(schema ?? Schema.viaq),
            schema: schema ?? Schema.viaq,
          }),
        ).toEqual(expectedQuery);
      },
    );
  });
});
