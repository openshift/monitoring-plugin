import { Duration, Unit } from '../time';
import { NetflowDomain } from '../korrel8r/netflow';
import { Constraint, Query, URIRef } from '../korrel8r/types';

// Korrel8r queries contain less information than console URLs.
// Round-trip conversion is not always equal.
// The following pairs _can_ round trip, and are testsed in both directions.
// The tests for fromURL and fromQuery test asymmetric cases.
const roundTrip = [
  {
    query: 'netflow:network:{SrcK8S_Type="Pod",SrcK8S_Namespace="myNamespace"}',
    url: `netflow-traffic?tenant=network&filters=${encodeURIComponent(
      'src_kind=Pod;src_namespace=myNamespace',
    )}&startTime=1742896800&endTime=1742940000`,
    constraint: {
      start: '2025-03-25T10:00:00.000Z',
      end: '2025-03-25T22:00:00.000Z',
    },
  },
  {
    url: 'netflow-traffic?tenant=network&filters=src_namespace%3Dnetobserv&startTime=1742896800&endTime=1742940000',
    query: 'netflow:network:{SrcK8S_Namespace="netobserv"}',
    constraint: {
      start: '2025-03-25T10:00:00.000Z',
      end: '2025-03-25T22:00:00.000Z',
    },
  },
  {
    url: 'netflow-traffic?tenant=network&filters=src_namespace%3Dnetobserv',
    query: 'netflow:network:{SrcK8S_Namespace="netobserv"}',
  },
];

describe('NetflowNode.fromQuery', () => {
  it.each([
    ...roundTrip,
    {
      url: `netflow-traffic?tenant=network&filters=${encodeURIComponent(
        'src_namespace=foo',
      )}&startTime=1742896800&endTime=1742940000`,
      query: 'netflow:network:{InvalidKey="Pod",SrcK8S_Namespace="foo"}',
      constraint: {
        start: '2025-03-25T10:00:00.000Z',
        end: '2025-03-25T22:00:00.000Z',
      },
    },
    {
      url: `netflow-traffic?tenant=network&filters=${encodeURIComponent(
        'dst_kind=Pod;src_namespace="openshift-oauth-apiserver","tracing-app-k6"',
      )}&startTime=1742896800&endTime=1742940000`,
      query:
        'netflow:network:{DstK8S_Type="Pod",SrcK8S_Namespace=~"openshift-oauth-apiserver|tracing-app-k6"}',
      constraint: {
        start: '2025-03-25T10:00:00.000Z',
        end: '2025-03-25T22:00:00.000Z',
      },
    },
  ])(`from $query`, ({ query, url, constraint }) =>
    expect(
      new NetflowDomain().queryToLink(Query.parse(query), Constraint.fromAPI(constraint)),
    ).toEqual(new URIRef(url)),
  );
});

describe('NetflowNode.fromURL', () => {
  it.each([
    ...roundTrip,
    {
      url: `netflow-traffic?tenant=network&filters=${encodeURIComponent(
        'src_namespace=netobserv',
      )}&limit=5&match=all`,
      query: 'netflow:network:{SrcK8S_Namespace="netobserv"}',
    },
    {
      url: 'netflow-traffic?timeRange=300&limit=5&match=all&packetLoss=all&recordType=flowLog&filters=flow_layer%3Dapp%3Bdst_kind%3DPod%3Bsrc_kind%3DPod&bnf=false',
      query: 'netflow:network:{DstK8S_Type="Pod",SrcK8S_Type="Pod"}',
    },
    {
      url: `netflow-traffic?tenant=network&filters=${encodeURIComponent(
        'dst_kind=Pod;dst_namespace=hostpath-provisioner;src_namespace="openshift-oauth-apiserver","tracing-app-k6"',
      )}`,
      query:
        'netflow:network:{DstK8S_Type="Pod",DstK8S_Namespace="hostpath-provisioner",SrcK8S_Namespace=~"openshift-oauth-apiserver|tracing-app-k6"}',
    },
  ])(`from $url`, ({ query, url }) =>
    expect(new NetflowDomain().linkToQuery(new URIRef(url))).toEqual(Query.parse(query)),
  );
});

describe('', () => {
  it.each([
    {
      url: 'netflow-traffi',
      expected: 'unknown netflow link: netflow-traffi',
    },
  ])('expect error fromURL($url)', ({ url, expected }) => {
    expect(() => new NetflowDomain().linkToQuery(new URIRef(url))).toThrow(expected);
  });

  it.each([
    {
      query: 'netflo',
      expected: 'invalid query: netflo',
    },
    {
      query: 'netflow:incorrect:{}',
      expected: 'unknown query: netflow:incorrect:{}: unknown class',
    },
    {
      query: 'netflow:network:{SrcK8S_Type="Pod"=wrong}',
      expected: 'unknown query: netflow:network:{SrcK8S_Type="Pod"=wrong}',
    },
    {
      query: 'netflow:network:{SrcK8S_Type}',
      expected: 'unknown query: netflow:network:{SrcK8S_Type}',
    },
  ])('expect error fromQuery($query)', ({ query, expected }) => {
    expect(() => new NetflowDomain().queryToLink(Query.parse(query))).toThrow(expected);
  });
});

describe('NetflowDomain.queryToLink with duration constraint', () => {
  it('uses timeRange when end is close to now', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T12:00:00Z').getTime());
    const domain = new NetflowDomain();
    const query = Query.parse('netflow:network:{SrcK8S_Namespace="default"}');
    const constraint = Constraint.fromAPI({
      start: '2024-01-01T11:45:00.000Z',
      end: new Date(Date.now()).toISOString(),
    });
    const link = domain.queryToLink(query, constraint);
    expect(link.searchParams.get('timeRange')).toEqual('900');
    expect(link.searchParams.get('startTime')).toBeFalsy();
    expect(link.searchParams.get('endTime')).toBeFalsy();
    jest.restoreAllMocks();
  });

  it('uses startTime/endTime when end is not close to now', () => {
    const domain = new NetflowDomain();
    const query = Query.parse('netflow:network:{SrcK8S_Namespace="default"}');
    const constraint = Constraint.fromAPI({
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
    });
    const link = domain.queryToLink(query, constraint);
    expect(link.searchParams.get('timeRange')).toBeFalsy();
    expect(link.searchParams.get('startTime')).toEqual(
      String(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)),
    );
    expect(link.searchParams.get('endTime')).toEqual(
      String(Math.floor(new Date('2024-01-02T00:00:00Z').getTime() / 1000)),
    );
  });
});

describe('NetflowDomain.linkToPeriod', () => {
  it('parses timeRange to Duration', () => {
    const domain = new NetflowDomain();
    const link = new URIRef('netflow-traffic?timeRange=900');
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(true);
    expect((period as Duration).count).toEqual(900);
    expect((period as Duration).unit).toEqual(Unit.SECOND);
  });

  it('parses startTime/endTime to Range', () => {
    const domain = new NetflowDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-02T00:00:00Z');
    const startTime = Math.floor(start.getTime() / 1000);
    const endTime = Math.floor(end.getTime() / 1000);
    const link = new URIRef(`netflow-traffic?startTime=${startTime}&endTime=${endTime}`);
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart, pEnd] = period!.startEnd();
    expect(pStart).toEqual(start);
    expect(pEnd).toEqual(end);
  });

  it('returns undefined when no time params', () => {
    const domain = new NetflowDomain();
    const link = new URIRef('netflow-traffic?tenant=network');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('defaults endTime to now when missing', () => {
    const domain = new NetflowDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const startTime = Math.floor(start.getTime() / 1000);
    const link = new URIRef(`netflow-traffic?startTime=${startTime}`);
    const period = domain.linkToPeriod(link);
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart] = period!.startEnd();
    expect(pStart).toEqual(start);
  });

  it('returns undefined for an unparseable timeRange', () => {
    const domain = new NetflowDomain();
    const link = new URIRef('netflow-traffic?timeRange=not-a-number');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('returns undefined for an unparseable startTime', () => {
    const domain = new NetflowDomain();
    const link = new URIRef('netflow-traffic?startTime=not-a-number');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('returns undefined for an unparseable endTime', () => {
    const domain = new NetflowDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const startTime = Math.floor(start.getTime() / 1000);
    const link = new URIRef(`netflow-traffic?startTime=${startTime}&endTime=not-a-number`);
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });
});
