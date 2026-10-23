import { Duration, Unit } from '../time';
import { LogDomain } from '../korrel8r/log';
import { Constraint, Query, URIRef } from '../korrel8r/types';

beforeAll(() => {
  // Mock API pod resource for pod log queries.
  const resources = {
    consoleVersion: 'x.y.z',
    models: [
      {
        kind: 'Pod',
        apiVersion: 'v1',
        path: 'pods',
        verbs: ['watch'],
      },
    ],
  };
  localStorage.setItem('bridge/api-discovery-resources', JSON.stringify(resources));
  window['SERVER_FLAGS'] = { consoleVersion: 'x.y.z' };
});

describe('LogDomain.linkToQuery', () => {
  it.each([
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}',
      )}&tenant=infrastructure`,
      query:
        `log:infrastructure:{kubernetes_namespace_name="default"` + `,kubernetes_pod_name="foo"}`,
    },
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="default",' +
          'kubernetes_pod_name="foo",log_type="infrastructure"}',
      )}`,
      query:
        `log:infrastructure:{kubernetes_namespace_name="default",` +
        `kubernetes_pod_name="foo",log_type="infrastructure"}`,
    },
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}',
      )}&tenant=infrastructure`,
      query:
        `log:infrastructure:{kubernetes_namespace_name="default",` + `kubernetes_pod_name="foo"}`,
    },
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="default",kubernetes_pod_name="foo",log_type="infrastructure"}',
      )}&tenant=infrastructure`,
      query:
        `log:infrastructure:{kubernetes_namespace_name="default",` +
        `kubernetes_pod_name="foo",log_type="infrastructure"}`,
    },
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="foo",kubernetes_pod_name="bar"}',
      )}&tenant=application`,
      query: `log:application:{kubernetes_namespace_name="foo",kubernetes_pod_name="bar"}`,
    },
    {
      url: `monitoring/logs?q=${encodeURIComponent(
        '{kubernetes_namespace_name="kube",kubernetes_pod_name="bar",log_type="infrastructure"}',
      )}`,
      query:
        'log:infrastructure:{kubernetes_namespace_name="kube",kubernetes_pod_name="bar",log_type="infrastructure"}',
    },
    {
      url: '/monitoring/logs?q=%7Bkubernetes_namespace_name%3D%22openshift-image-registry%22%7D%7Cjson%7Ckubernetes_labels_docker_registry%3D%22default%22&tenant=infrastructure',
      query:
        'log:infrastructure:{kubernetes_namespace_name="openshift-image-registry"}|json|kubernetes_labels_docker_registry="default"',
    },
  ])('$url', ({ url, query }) =>
    expect(new LogDomain().linkToQuery(new URIRef(url))).toEqual(Query.parse(query)),
  );
});

describe('LogDomain.queryToLink', () => {
  it.each([
    {
      // LogQL query
      query: `log:infrastructure:{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}`,
      q: '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}|json',
      tenant: 'infrastructure',
    },
    {
      // LogQL query already has |json - no duplication
      query:
        'log:infrastructure:' +
        '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}|json',
      q: '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}|json',
      tenant: 'infrastructure',
    },
    {
      // LogQL query with |json mid-pipeline - no duplication
      query:
        'log:infrastructure:' +
        '{kubernetes_namespace_name="default"}|json|kubernetes_labels_app="foo"',
      q: '{kubernetes_namespace_name="default"}|json|kubernetes_labels_app="foo"',
      tenant: 'infrastructure',
    },
    {
      // k8s Pod query - |json appended automatically
      query: 'log:infrastructure:{"namespace":"default","name":"foo"}',
      q: '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}|json',
      tenant: 'infrastructure',
    },
    {
      // k8s Pod query with labels
      query: 'log:infrastructure:{"namespace":"default","name":"foo","labels":{"a":"b","c":"d"}}',
      q: '{kubernetes_namespace_name="default",kubernetes_pod_name="foo"}|json|kubernetes_labels_a="b"|kubernetes_labels_c="d"',
      tenant: 'infrastructure',
    },
    {
      // k8s partial query
      query: 'log:infrastructure:{"namespace":"default","labels":{}}',
      q: '{kubernetes_namespace_name="default"}|json',
      tenant: 'infrastructure',
    },
    {
      // k8s partial query
      query:
        'log:infrastructure:{"namespace":"openshift-monitoring","labels":{"app":"cluster-monitoring-operator"}}',
      q: '{kubernetes_namespace_name="openshift-monitoring"}|json|kubernetes_labels_app="cluster-monitoring-operator"',
      tenant: 'infrastructure',
    },

    {
      // Empty query - |json appended automatically
      query: 'log:application:{}',
      q: '{}|json',
      tenant: 'application',
    },
  ])('$query', ({ query, q, tenant }) => {
    const got = new LogDomain().queryToLink(
      Query.parse(query),
      Constraint.fromAPI({
        start: '2025-03-25T10:00:00.000Z',
        end: '2025-03-25T22:00:00.000Z',
      }),
    );
    const want = new URIRef('monitoring/logs', {
      q,
      tenant,
      start: 1742896800000,
      end: 1742940000000,
    });
    expect(got.toString()).toEqual(want.toString());
  });
});

describe('expected errors', () => {
  it.each([
    {
      url: 'monitoring/log',
      expected: 'unknown log link: monitoring/log',
    },
    {
      url: 'monitoring/logs?q={kubernetes_namespace_name="default",kubernetes_pod_name="foo"}',
      expected:
        'unknown log link: monitoring/logs?q=%7Bkubernetes_namespace_name%3D%22default%22%2Ckubernetes_pod_name%3D%22foo%22%7D',
    },
  ])('error from url: $url', ({ url, expected }) => {
    expect(() => new LogDomain().linkToQuery(new URIRef(url))).toThrow(expected);
  });

  it.each([
    {
      query: 'foo:bar:baz',
      expected: 'unknown query: foo:bar:baz: unknown class',
    },
    {
      query: 'log:incorrect:{}',
      expected: 'unknown query: log:incorrect:{}: unknown class',
    },
  ])('error from query: $query', ({ query, expected }) => {
    expect(() => new LogDomain().queryToLink(Query.parse(query))).toThrow(expected);
  });
});

describe('LogDomain.queryToLink with duration constraint', () => {
  it('uses now-Xm format when end is close to now', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T12:00:00Z').getTime());
    const domain = new LogDomain();
    const query = Query.parse('log:infrastructure:{kubernetes_namespace_name="default"}');
    const constraint = Constraint.fromAPI({
      start: '2024-01-01T11:45:00.000Z',
      end: new Date(Date.now()).toISOString(),
    });
    const link = domain.queryToLink(query, constraint);
    expect(link.searchParams.get('start')).toEqual('now-15m');
    expect(link.searchParams.get('end')).toEqual('now');
    jest.restoreAllMocks();
  });

  it('uses timestamps when end is not close to now', () => {
    const domain = new LogDomain();
    const query = Query.parse('log:infrastructure:{kubernetes_namespace_name="default"}');
    const constraint = Constraint.fromAPI({
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
    });
    const link = domain.queryToLink(query, constraint);
    expect(link.searchParams.get('start')).toEqual(
      String(new Date('2024-01-01T00:00:00Z').getTime()),
    );
    expect(link.searchParams.get('end')).toEqual(
      String(new Date('2024-01-02T00:00:00Z').getTime()),
    );
  });
});

describe('LogDomain.linkToPeriod', () => {
  it('parses now-Xm format to Duration', () => {
    const domain = new LogDomain();
    const link = new URIRef('monitoring/logs?start=now-15m&end=now');
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(true);
    expect((period as Duration).count).toEqual(15);
    expect((period as Duration).unit).toEqual(Unit.MINUTE);
  });

  it('parses timestamps to Range', () => {
    const domain = new LogDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-02T00:00:00Z');
    const link = new URIRef(`monitoring/logs?start=${start.getTime()}&end=${end.getTime()}`);
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart, pEnd] = period!.startEnd();
    expect(pStart).toEqual(start);
    expect(pEnd).toEqual(end);
  });

  it('returns default when no start param', () => {
    const domain = new LogDomain();
    const link = new URIRef('monitoring/logs?end=now');
    expect(domain.linkToPeriod(link)).toEqual(new Duration(1, Unit.HOUR));
  });

  it('defaults end to now when end param is missing', () => {
    const domain = new LogDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const link = new URIRef(`monitoring/logs?start=${start.getTime()}`);
    const period = domain.linkToPeriod(link);
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart] = period!.startEnd();
    expect(pStart).toEqual(start);
  });

  it('returns undefined for an unparseable start param', () => {
    const domain = new LogDomain();
    const link = new URIRef('monitoring/logs?start=not-a-date');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('returns undefined for an unparseable end param', () => {
    const domain = new LogDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const link = new URIRef(`monitoring/logs?start=${start.getTime()}&end=not-a-date`);
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });
});
