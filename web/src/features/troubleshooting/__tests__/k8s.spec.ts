import { K8sDomain } from '../korrel8r/k8s';
import { Query, URIRef } from '../korrel8r/types';

const k8s = new K8sDomain();

beforeAll(() => {
  // Mock API discovery resources.
  const resources = {
    consoleVersion: 'x.y.z',
    models: [
      {
        kind: 'Pod',
        apiVersion: 'v1',
        path: 'pods',
        verbs: ['watch'],
      },
      {
        kind: 'Deployment',
        apiVersion: 'v1',
        apiGroup: 'apps',
        path: 'deployments',
        verbs: ['watch'],
      },
      {
        kind: 'Event',
        apiVersion: 'v1',
        path: 'events',
        verbs: ['watch'],
      },
      {
        kind: 'Event',
        apiVersion: 'v1',
        apiGroup: 'events.k8s.io',
        path: 'events',
        verbs: ['watch'],
      },
      {
        kind: 'Namespace',
        apiVersion: 'v1',
        path: 'namespaces',
        verbs: ['watch'],
      },
      {
        kind: 'Node',
        apiVersion: 'v1',
        path: 'nodes',
        verbs: ['watch'],
      },
      {
        kind: 'Role',
        apiVersion: 'v1',
        apiGroup: 'rbac.authorization.k8s.io',
        path: 'roles',
        verbs: ['watch'],
      },
      {
        kind: 'Pod',
        apiVersion: 'v1',
        path: 'pods',
        verbs: ['watch'],
      },
      {
        kind: 'ClusterServiceVersion',
        apiVersion: 'v1alpha1',
        apiGroup: 'operators.coreos.com',
        path: 'operators',
        verbs: ['watch'],
      },
    ],
  };
  localStorage.setItem('bridge/api-discovery-resources', JSON.stringify(resources));
  window['SERVER_FLAGS'] = { consoleVersion: 'x.y.z' };
});

describe('K8sDomain.linkToQuery', () => {
  it.each([
    { url: '/k8s/all-namespaces/apps~v1~Deployment', query: 'k8s:Deployment.v1.apps:{}' },
    { url: '/search/all-namespaces/apps~v1~Deployment', query: 'k8s:Deployment.v1.apps:{}' },
    { url: '/api-resource/all-namespaces/apps~v1~Deployment', query: 'k8s:Deployment.v1.apps:{}' },
    {
      url: 'k8s/ns/korrel8r/apps~v1~Deployment',
      query: 'k8s:Deployment.v1.apps:{"namespace":"korrel8r"}',
    },

    { url: '/k8s/ns/x/apps~v1~Deployment', query: 'k8s:Deployment.v1.apps:{"namespace":"x"}' },
    { url: '/search/ns/x/apps~v1~Deployment', query: 'k8s:Deployment.v1.apps:{"namespace":"x"}' },
    {
      url: '/api-resource/ns/x/apps~v1~Deployment',
      query: 'k8s:Deployment.v1.apps:{"namespace":"x"}',
    },
    {
      url: '/api-resource/ns/x/apps~v1~Deployment/instances',
      query: 'k8s:Deployment.v1.apps:{"namespace":"x"}',
    },
    {
      url: '/k8s/ns/x/deployments/y',
      query: 'k8s:Deployment.v1.apps:{"namespace":"x","name":"y"}',
    },
    {
      url: '/k8s/ns/default/core~v1~Pod/bad-deployment-000000000-00000',
      query: 'k8s:Pod.v1:{"namespace":"default","name":"bad-deployment-000000000-00000"}',
    },
    {
      url: `/k8s/ns/default/core~v1~Pod/foo`,
      query: `k8s:Pod.v1:{"namespace":"default","name":"foo"}`,
    },
    { url: `/k8s/ns/default/core~v1~Pod`, query: `k8s:Pod.v1:{"namespace":"default"}` },
    { url: `/k8s/cluster/projects/foo`, query: `k8s:Namespace.v1:{"name":"foo"}` },
    {
      url: `/k8s/ns/x/operators.coreos.com~v1alpha1~ClusterServiceVersion/y`,
      query: `k8s:ClusterServiceVersion.v1alpha1.operators.coreos.com:{"namespace":"x","name":"y"}`,
    },
    { url: `/search/all-namespaces?kind=core~v1~Pod`, query: `k8s:Pod.v1:{}` },
    { url: `/k8s/all-namespaces/core~v1~Pod`, query: `k8s:Pod.v1:{}` },
    { url: `/k8s/cluster/nodes/oscar7`, query: `k8s:Node.v1:{"name":"oscar7"}` },
    { url: `/api-resource/cluster/core~v1~Node`, query: `k8s:Node.v1:{}` },
    { url: '/k8s/ns/netobserv/core~v1~Pod', query: 'k8s:Pod.v1:{"namespace":"netobserv"}' },
    {
      url: '/k8s/ns/foo/core~v1~Pod/bar/events',
      query:
        'k8s:Event.v1:{"fields":{"involvedObject.namespace":"foo","involvedObject.name":"bar","involvedObject.apiVersion":"v1","involvedObject.kind":"Pod"}}',
    },
    {
      url: '/k8s/ns/openshift-lightspeed/operators.coreos.com~v1alpha1~ClusterServiceVersion/lightspeed-operator.v1.0.5/events',
      query:
        'k8s:Event.v1:{"fields":{"involvedObject.namespace":"openshift-lightspeed","involvedObject.name":"lightspeed-operator.v1.0.5","involvedObject.apiVersion":"operators.coreos.com/v1alpha1","involvedObject.kind":"ClusterServiceVersion"}}',
    },
  ])('converts $url', ({ url, query }) => {
    expect(k8s.linkToQuery(new URIRef(url))).toEqual(Query.parse(query));
  });
});

describe('K8sDomain.queryToLink', () => {
  it.each([
    // Variations on query parameters.
    // Note "fields" are ignored.
    {
      query: 'k8s:Pod.v1:{"namespace":"default","name":"bad-deployment-000000000-00000"}',
      url: 'k8s/ns/default/core~v1~Pod/bad-deployment-000000000-00000',
    },
    {
      query: `k8s:Pod:{"namespace":"x","name":"y","labels":{"a":"b","c":"d"},"fields": {"x":"y"}}`,
      url: `k8s/ns/x/core~v1~Pod/y?label=${encodeURIComponent(
        'a=b,c=d',
      )}&fields=${encodeURIComponent('x=y')}`,
    },
    {
      query:
        'k8s:Event.v1:{"fields":{"involvedObject.namespace":"default","involvedObject.name":"bad-deployment-000000000-00000","involvedObject.apiVersion":"v1","involvedObject.kind":"Pod"}}',
      url: 'k8s/ns/default/core~v1~Pod/bad-deployment-000000000-00000/events',
    },
    {
      query:
        'k8s:Event.v1.events.k8s.io:{"fields":{"regarding.namespace":"default","regarding.name":"bad-deployment-000000000-00000","regarding.apiVersion":"v1","regarding.kind":"Pod"}}',
      url: 'k8s/ns/default/core~v1~Pod/bad-deployment-000000000-00000/events',
    },
    {
      query: `k8s:Pod:{ "namespace":"x", "name":"y", "labels":{ "a":"b" } }`,
      url: `k8s/ns/x/core~v1~Pod/y?label=${encodeURIComponent('a=b')}`,
    },
    {
      query: `k8s:Pod:{ "namespace":"x", "labels":{ "a":"b" } }`,
      url: `k8s/ns/x/core~v1~Pod?label=${encodeURIComponent('a=b')}`,
    },
    { query: `k8s:Pod.v1:{ "namespace":"x", "name":"y" }`, url: `k8s/ns/x/core~v1~Pod/y` },
    { query: `k8s:Pod.v1:{ "namespace":"x" }`, url: `k8s/ns/x/core~v1~Pod` },
    {
      query: `k8s:Pod.v1:{ "labels":{ "a":"b" } }`,
      url: `search/all-namespaces?label=${encodeURIComponent('a=b')}&kind=core~v1~Pod`,
    },
    {
      query: `k8s:Pod.v1:{"namespace":"x","labels":{"a":"b"}}`,
      url: `k8s/ns/x/core~v1~Pod?label=${encodeURIComponent('a=b')}`,
    },

    // Variations on korrel8r class spec.
    {
      query: `k8s:Role.v1.rbac.authorization.k8s.io:{ "namespace":"x", "name":"y" }`,
      url: `k8s/ns/x/rbac.authorization.k8s.io~v1~Role/y`,
    },
    { query: `k8s:Pod:{}`, url: 'k8s/all-namespaces/core~v1~Pod' },
    // Event queries without fields (directly querying events by namespace)
    {
      query: 'k8s:Event.v1.events.k8s.io:{"namespace":"openshift-logging"}',
      url: 'k8s/ns/openshift-logging/events.k8s.io~v1~Event',
    },
    {
      query: 'k8s:Event.v1:{"namespace":"openshift-cluster-observability-operator"}',
      url: 'k8s/ns/openshift-cluster-observability-operator/core~v1~Event',
    },
  ])('converts $query to $url', ({ url, query }) => {
    expect(k8s.queryToLink(Query.parse(query)).toString()).toEqual(new URIRef(url).toString());
  });

  it.each([{ query: `foo:bar:baz` }])('raises error on $query', ({ query }) =>
    expect(() => k8s.queryToLink(Query.parse(query))).toThrow(TypeError),
  );
});
