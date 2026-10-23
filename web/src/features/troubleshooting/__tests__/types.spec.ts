import * as api from '../korrel8r/client';
import { Period, Range } from '../time';

import {
  Class,
  Constraint,
  Domain,
  Domains,
  Edge,
  Graph,
  Node,
  Query,
  URIRef,
  joinPath,
  unixMilliseconds,
  unixSeconds,
} from '../korrel8r/types';

describe('Query', () => {
  it('converts to/from string', () => {
    const abc = new Class('a', 'b').query('c=d');
    expect(abc.toString()).toEqual('a:b:c=d');
    expect(Query.parse('a:b:c=d')).toEqual(abc);
    expect(() => Query.parse('x')).toThrow(/invalid query: x/);
  });
});

class FakeDomain extends Domain {
  constructor(name: string) {
    super(name);
  }

  class(name: string): Class {
    return new Class(this.name, name);
  }

  linkToQuery(link: URIRef): Query {
    const m = link?.pathname?.match(new RegExp(`/?${this.name}/([^/]+)`));
    if (!m) throw this.badLink(link);
    return new Class(this.name, m[1]).query(link.searchParams.toString());
  }

  queryToLink(query: Query, constraint?: Constraint): URIRef {
    if (!query || !query.class || query.class.domain != this.name) throw this.badQuery(query);
    return new URIRef(`${query.class.domain}/${query.class.name}?${query.selector}`, {
      constraint: constraint,
    });
  }
}

const start = new Date(1969, 2, 21);
const end = new Date(1969, 2, 22);

describe('Constraint', () => {
  it.each([
    { clientC: {}, typesC: {} },
    {
      clientC: { start: start.toISOString(), end: end.toISOString() },
      typesC: { period: new Range(start, end) },
    },
    { clientC: { limit: 50 }, typesC: { limit: 50 } },
  ] as Array<{ clientC: api.Constraint; typesC: { period?: Period; limit?: number } }>)(
    'from/toAPI %s',
    ({ clientC, typesC }) => {
      const c = new Constraint(typesC);
      expect(Constraint.fromAPI(clientC)).toEqual(c);
      expect(c.toAPI()).toEqual(clientC); // Round trip.
    },
  );
});

describe('Domain', () => {
  const d = new FakeDomain('a');
  const abc = d.class('b').query('c=d');
  it('queryToLink', () => {
    expect(d.queryToLink(abc).toString()).toEqual('a/b?c=d');
    const query = Query.parse('x:b:c');
    expect(() => d.queryToLink(query)).toThrow('unknown query: x:b:c');
  });
  it('linkToQuery', () => {
    expect(d.linkToQuery(new URIRef('a/b?c=d'))).toEqual(abc);
    expect(d.linkToQuery(new URIRef('/a/b?c=d'))).toEqual(abc);
    expect(d.linkToQuery(new URIRef('http://blah/a/b?c=d'))).toEqual(abc);
  });
  it('linkToPeriod defaults to undefined when not overridden', () => {
    expect(d.linkToPeriod(new URIRef('a/b?start=15m'))).toBeUndefined();
  });
});

describe('Domains', () => {
  const ds = new Domains(...['a', 'x'].map((name: string): Domain => new FakeDomain(name)));
  const abc = Query.parse('a:b:c=d');
  const xyz = Query.parse('x:y:z=z');
  it('queryToLink', () => {
    expect(ds.queryToLink(abc).toString()).toEqual('a/b?c=d');
    expect(ds.queryToLink(xyz).toString()).toEqual('x/y?z=z');
    expect(() => ds.queryToLink(Query.parse('z:b:c'))).toThrow(/unknown domain: z/);
  });
  it('linkToQuery', () => {
    expect(ds.linkToQuery(new URIRef('x/y?z=z'))).toEqual(xyz);
    expect(ds.linkToQuery(new URIRef('http://blah/a/b?c=d'))).toEqual(abc);
  });
});

describe('URIRef', () => {
  it('constructor', () => {
    const u = new URIRef('/a/b?c=d&x=y#z');
    expect(u.pathname).toEqual('/a/b');
    expect(Object.fromEntries(u.searchParams.entries())).toEqual({ c: 'd', x: 'y' });
    expect(u.hash).toEqual('#z');
  });

  it('constructor with moreParams', () => {
    const u = new URIRef('/a/b?c=d&x=y', { c: 'dd', q: 'foo' });
    expect(u.pathname).toEqual('/a/b');
    expect(Object.fromEntries(u.searchParams.entries())).toEqual({ c: 'dd', x: 'y', q: 'foo' });
  });

  it.each(['', '/a/b?c=d&x=y#z', '/path', 'relpath', '/k8s/ns/netobserv/core~v1~Pod'])(
    'round trip: %s',
    (str) => {
      expect(new URIRef(str).toString()).toEqual(str);
    },
  );

  it.each([
    ['a/b?c=d&x=y#z', 'http://example/x/', 'http://example/x/a/b?c=d&x=y#z'], // Relative
    ['/a/b?c=d&x=y#z', 'http://example/x/', 'http://example/a/b?c=d&x=y#z'], // Absolute
  ])('resolve to URL: %s', (ref, base, want) => {
    expect(new URIRef(ref).resolve(base).toString()).toEqual(want);
  });
});

describe('Node', () => {
  it('constructor', () => {
    expect(
      new Node({
        class: 'a:b',
        count: 10,
        queries: [
          { query: 'a:b:c', count: 5 },
          { query: 'a:b:d', count: 5 },
        ],
      }),
    ).toEqual({
      id: 'a:b',
      count: 10,
      class: { domain: 'a', name: 'b' },
      queries: [
        {
          query: { class: { domain: 'a', name: 'b' }, selector: 'c' },
          count: 5,
          statuses: [],
        },
        {
          query: { class: { domain: 'a', name: 'b' }, selector: 'd' },
          count: 5,
          statuses: [],
        },
      ],
    });
  });

  it('constructor bad class', () => {
    expect(new Node({ class: 'foobar', count: 1 })).toEqual({
      id: 'foobar',
      count: 1,
      disabled: 'invalid class: foobar',
      queries: [],
    });
  });
});

describe('Graph', () => {
  const a: api.Graph = {
    nodes: [
      { class: 'a:x', count: 1, queries: [{ query: 'a:x:one', count: 1 }] },
      { class: 'b:y', count: 2, queries: [{ query: 'b:y:two', count: 2 }] },
      {
        class: 'c:z',
        count: 4,
        queries: [
          { query: 'c:z:one', count: 1 },
          { query: 'c:z:three', count: 3 },
        ],
      },
    ],
    edges: [
      { start: 'a:x', goal: 'b:y' },
      { start: 'a:x', goal: 'c:z' },
      { start: 'b:y', goal: 'c:z' },
    ],
  };
  const g = new Graph(a);
  g.nodes.forEach((n) => expect(g.node(n.id)).toEqual(n)); // Lookup nodes
  expect(g.nodes).toEqual(a.nodes.map((n) => new Node(n)));
  expect(g.edges).toEqual(a.edges.map((e) => new Edge(g.node(e.start), g.node(e.goal))));
});

describe('unixMilliseconds/unixSeconds', () => {
  it('returns 0 for the unix epoch rather than undefined', () => {
    const epoch = new Date(0);
    expect(unixMilliseconds(epoch)).toEqual(0);
    expect(unixSeconds(epoch)).toEqual(0);
  });

  it('returns undefined for an undefined date', () => {
    expect(unixMilliseconds(undefined)).toBeUndefined();
    expect(unixSeconds(undefined)).toBeUndefined();
  });

  it('converts milliseconds to seconds, rounding down', () => {
    expect(unixSeconds(new Date(1500))).toEqual(1);
  });
});

describe('joinPath', () => {
  it.each([
    // Basic path joining
    ['path1', 'path2', 'path1/path2'],
    ['path1', 'path2', 'path3', 'path1/path2/path3'],

    // Handling trailing slash on first path
    ['path1/', 'path2', 'path1/path2'],
    ['path1//', 'path2', 'path1/path2'],

    // Handling leading slashes on subsequent paths
    ['path1', '/path2', 'path1/path2'],
    ['path1', '//path2', 'path1/path2'],

    // Handling trailing slashes on subsequent paths
    ['path1', 'path2/', 'path1/path2'],
    ['path1', 'path2//', 'path1/path2'],

    // Complex combinations
    ['path1/', '/path2/', '/path3/', 'path1/path2/path3'],
    ['/path1/', '//path2//', '///path3///', '/path1/path2/path3'],

    // Empty paths
    ['', 'path2', '/path2'],
    ['path1', '', 'path1/'],
    ['', '', '/'],

    // Single path
    ['single', 'single'],
    ['single/', 'single'],
    ['/single/', '/single'],

    // Absolute paths
    ['/absolute', 'relative', '/absolute/relative'],
    ['/absolute/', '/relative/', '/absolute/relative'],
  ] as Array<string[]>)('joins paths correctly: %s', (...args: string[]) => {
    const expected = args.pop() as string;
    const paths = args as string[];
    const [first, ...rest] = paths;
    expect(joinPath(first, ...rest)).toEqual(expected);
  });
});
