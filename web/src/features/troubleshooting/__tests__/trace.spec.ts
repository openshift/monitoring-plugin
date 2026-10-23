import { Duration, Unit } from '../time';
import { TraceDomain } from '../korrel8r/trace';
import { Constraint, Query, URIRef } from '../korrel8r/types';

const tempo = 'namespace=openshift-tracing&name=platform&tenant=platform';

const roundtrip = [
  {
    url: `observe/traces?${tempo}`,
    query: `trace:span:{}`,
  },
  {
    url: `observe/traces?${tempo}&q=%7Bresource.service.name%3D%22article-service%22%7D`,
    query: `trace:span:{resource.service.name="article-service"}`,
  },
  {
    url: `observe/traces/1599dfd76bc896101a9811857ae3c3c9?${tempo}`,
    query: `trace:span:{trace:id="1599dfd76bc896101a9811857ae3c3c9"}`,
  },
];

describe('TraceDomain.fromURL', () => {
  it.each([
    ...roundtrip,
    {
      url: `observe/traces`,
      query: `trace:span:{}`,
    },
  ])('$url', ({ url, query }) =>
    expect(new TraceDomain().linkToQuery(new URIRef(url))).toEqual(Query.parse(query)),
  );
});

describe('TraceDomain.fromQuery', () => {
  it.each([
    ...roundtrip,
    {
      query: `trace:span:{resource.service.name="shop-backend"}`,
      url: `observe/traces?${tempo}&q=%7Bresource.service.name%3D%22shop-backend%22%7D`,
    },
  ])('$query', ({ query, url }) => {
    expect(new TraceDomain().queryToLink(Query.parse(query)).toString()).toEqual(url);
  });
});

describe('TraceDomain.queryToLink with duration constraint', () => {
  it('uses duration string when end is close to now', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T12:00:00Z').getTime());
    const domain = new TraceDomain();
    const query = Query.parse('trace:span:{}');
    const constraint = Constraint.fromAPI({
      start: '2024-01-01T11:45:00.000Z',
      end: new Date(Date.now()).toISOString(),
    });
    const link = domain.queryToLink(query, constraint);
    expect(link.searchParams.get('start')).toEqual('15m');
    expect(link.searchParams.get('end')).toBeFalsy();
    jest.restoreAllMocks();
  });

  it('uses timestamps when end is not close to now', () => {
    const domain = new TraceDomain();
    const query = Query.parse('trace:span:{}');
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

describe('TraceDomain.linkToPeriod', () => {
  it('parses duration string to Duration', () => {
    const domain = new TraceDomain();
    const link = new URIRef('observe/traces?start=15m');
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(true);
    expect((period as Duration).count).toEqual(15);
    expect((period as Duration).unit).toEqual(Unit.MINUTE);
  });

  it('parses timestamps to Range', () => {
    const domain = new TraceDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-02T00:00:00Z');
    const link = new URIRef(`observe/traces?start=${start.getTime()}&end=${end.getTime()}`);
    const period = domain.linkToPeriod(link);
    expect(period).toBeDefined();
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart, pEnd] = period!.startEnd();
    expect(pStart).toEqual(start);
    expect(pEnd).toEqual(end);
  });

  it('returns undefined when no start param', () => {
    const domain = new TraceDomain();
    const link = new URIRef('observe/traces?q={}');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('defaults end to now when end param is missing', () => {
    const domain = new TraceDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const link = new URIRef(`observe/traces?start=${start.getTime()}`);
    const period = domain.linkToPeriod(link);
    expect(Duration.isDuration(period!)).toBe(false);
    const [pStart] = period!.startEnd();
    expect(pStart).toEqual(start);
  });

  it('returns undefined for an unparseable start param', () => {
    const domain = new TraceDomain();
    const link = new URIRef('observe/traces?start=not-a-date');
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });

  it('returns undefined for an unparseable end param', () => {
    const domain = new TraceDomain();
    const start = new Date('2024-01-01T00:00:00Z');
    const link = new URIRef(`observe/traces?start=${start.getTime()}&end=not-a-date`);
    expect(domain.linkToPeriod(link)).toBeUndefined();
  });
});
