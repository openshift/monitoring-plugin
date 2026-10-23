/** Type-safe versions of the Korrel8r API types. */
import { periodFrom, Period } from '../time';
import * as api from './client';

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export class Class {
  constructor(
    public domain: string,
    public name: string,
  ) {}

  query(selector: string) {
    return new Query(this, selector);
  }

  // Parse a full class name "domain:className".
  // @throws {TypeError} if it is not a valid Korrel8r class name.
  static parse(fullName: string): Class {
    const m = fullName?.match(/^([^:]+):([^:]+)$/);
    if (!m) throw new TypeError(`invalid class: ${fullName}`);
    return new Class(m[1], m[2]);
  }

  toString(): string {
    return `${this.domain}:${this.name}`;
  }
}

export class Query {
  class: Class;
  selector: string;

  constructor(c: Class, selector: string) {
    this.class = c;
    this.selector = selector;
  }

  // Parse a full query name "domain:class:selector".
  // @throws (TypeError) if it is not a valid Korrel8r query.
  static parse(query: string): Query {
    const m = query.match(/^([^:]+):([^:]+):(.+)$/);
    if (!m) throw new TypeError(`invalid query: ${query}`);
    return new Query(new Class(m[1], m[2]), m[3]);
  }

  // Convert to string.
  toString(): string {
    return `${this.class}:${this.selector}`;
  }
}

// Parse a date, return undefined if not valid rather than NaN or an invalid Date.
const parseDate = (s: string): Date | undefined => {
  const d = new Date(s);
  return d?.valueOf() ? d : undefined;
};

export class Constraint {
  public period?: Period;
  public limit?: number;

  constructor(args: { period?: Period; limit?: number } = {}) {
    Object.assign(this, args);
  }

  static fromAPI(constraint: api.Constraint): Constraint | undefined {
    if (!constraint) return undefined;
    const start = parseDate(constraint.start);
    const end = parseDate(constraint.end);
    return new Constraint({
      period: periodFrom(start, end),
      limit: constraint?.limit,
    });
  }

  toAPI(): api.Constraint {
    const [start, end] = this.period?.startEnd() ?? [];
    return {
      start: start?.toISOString(),
      end: end?.toISOString(),
      limit: this?.limit,
    };
  }
}

// Domain converts between Korrel8r queries and URLs for a Korrel8r domain.
export abstract class Domain {
  constructor(public name: string) {}

  classLabel(name: string): string {
    return capitalize(name);
  }

  /** Construct a Class object for this domain.
   * @throw {TypeError} if the name is not valid.
   */
  abstract class(name: string): Class;

  // Convert a URI reference to a Query.
  // @throws {TypeError} if the conversion fails.
  abstract linkToQuery(link: URIRef): Query;

  // Convert a Query to a relative URI reference.
  // @throws {TypeError} if the conversion fails.
  abstract queryToLink(query: Query, constraint?: Constraint): URIRef;

  // Convert a URI reference to a Period.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  linkToPeriod(_link: URIRef): Period | undefined {
    return undefined;
  }

  protected badClass(name: string): TypeError {
    return new TypeError(`class not found: ${this.name}:${name}`);
  }
  protected badQuery(q: Query, msg?: string): TypeError {
    return new TypeError(`unknown query: ${q}${msg ? `: ${msg}` : ''}`);
  }
  protected badLink(link: URIRef, msg?: string): TypeError {
    return new TypeError(
      `unknown ${this.name} link: ${link?.toString() ?? '<empty>'}${msg ? `: ${msg}` : ''}`,
    );
  }

  protected checkQuery(q: Query): Query {
    if (q.class.domain != this.name) throw this.badQuery(q);
    q.class = this.class(q.class.name); // Validate and normalize
    return q;
  }
}

// URIRef is a relative URI reference.
// This is the `path?query#hash` part of a URL, with no `scheme://authority` part.
// Korrel8r queries are translated into links of this form.
export class URIRef {
  pathname: string;
  searchParams: URLSearchParams;
  hash: string;

  // Parse a URI reference.
  // @param link: a URI reference string to parse.
  // @param moreParams: additional searchParams to add.
  //   Replaces parameters parsed from the string if names match.
  // @throws {TypeError} if invalid.
  constructor(link: string, moreParams?: object) {
    // Use the URL Parser. It requires an absolute base URL so use a dummy.
    const url = new URL(link, 'http://invalid');
    if (link?.at(0) == '/') {
      this.pathname = url.pathname; // absolute
    } else {
      this.pathname = url.pathname.slice(1); // relative
    }
    this.searchParams = url.searchParams;
    this.hash = url.hash;
    if (moreParams) {
      for (const [k, v] of Object.entries(moreParams)) {
        if (k && v) {
          this.searchParams.append(k, v);
        }
      }
    }
  }

  // Resolve the URIRef against a base URL, return a URL.
  // @throw {TypeError} same as `new URL`
  resolve(base: string): URL {
    return new URL(this.toString(), base);
  }

  toString(): string {
    const search = this.searchParams.toString();
    return `${this.pathname}${search ? '?' : ''}${search}${this.hash}`;
  }
}

// Join and normalize paths, no leading, trailing or repeated '/' charactersa
export const joinPath = (path0: string, ...paths: string[]): string => {
  const clean = paths.map((path: string) => path.replaceAll(/(^\/*)|(\/*$)/g, ''));
  return [path0.replace(/\/*$/, ''), ...clean].join('/');
};

// Encode an object as a comma-separated, key=value list: 'key=value,key=value...'. No URI encoding.
export const keyValueList = (obj: { [key: string]: string }): string => {
  return Object.keys(obj || {})
    .map((k) => `${k}=${obj[k]}`)
    .join(',');
};

// Parse a key-value list: 'key=value,key=value...'
export const parseKeyValueList = (list: string): { [key: string]: string } => {
  const obj = {};
  if (list) {
    list.split(',').forEach((kv: string) => {
      const [k, v] = kv?.split('=') || [];
      if (k && v) obj[k] = v;
    });
  }
  return obj;
};

// Domains is a set domains used to convert between Query and Link.
// Conversion succeeds if it succees on any domain in the set.
export class Domains {
  domains: Map<string, Domain>;

  constructor(...domains: Domain[]) {
    this.domains = new Map<string, Domain>();
    for (const d of domains) this.set(d);
  }

  // Add a domain to the set.
  set(domain: Domain) {
    this.domains.set(domain.name, domain);
  }

  // Get a domain by name.
  // @throw TypeError if domain is not found
  get(name: string): Domain {
    const domain = this.domains.get(name);
    if (!domain) throw new TypeError(`unknown domain: ${name}`);
    return domain;
  }

  // Convert URI Reference to korrel8r query, try all available domains.
  // See {@link Domain#linkToQuery}
  // @throws {TypeError} if the url cannot be converted.
  linkToQuery(link: URIRef): Query {
    for (const domain of this.domains.values()) {
      try {
        return domain.linkToQuery(link);
      } catch {
        continue;
      }
    }
    throw new TypeError(`no domain recognizes link: ${link}`);
  }

  // Convert a korrel8r query to a relative URI Reference, try all available domains.
  // See {@link Domain#queryToLink}
  // @throws {TypeError} if the query cannot be converted.
  queryToLink(query: Query, constraint?: Constraint): URIRef {
    return this.get(query?.class?.domain).queryToLink(query, constraint);
  }

  // Parse and validate a class string, return a class object.
  // @throws {TypeError} if the class string is not valid..
  class(fullName: string): Class {
    const c = Class.parse(fullName);
    const domain = this.get(c.domain);
    return domain.class(c.name);
  }

  classLabel(c: Class): string {
    try {
      return this.get(c.domain).classLabel(c.name);
    } catch {
      return capitalize(c.name);
    }
  }
}

/** Integer unix millisecond timestamp. */
export const unixMilliseconds = (d: Date | undefined): number | undefined => {
  return d ? d.getTime() : undefined;
};

/** Integer unix seconds timestamp. */
export const unixSeconds = (d: Date | undefined): number | undefined => {
  const ms = unixMilliseconds(d);
  return ms === undefined ? undefined : Math.floor(ms / 1000);
};

export type StatusCount = api.StatusCount;

export class Node {
  id: string;
  count: number;
  class: Class;
  queries: Array<QueryCount>;
  disabled: string;

  /** Construct a type-safe node from an API node.
   *  Does not throw, sets the `disabled` field if there is an error.
   */
  constructor(node: api.Node) {
    this.id = node.class;
    this.count = node.count;
    try {
      this.class = Class.parse(node.class);
    } catch {
      this.disabled = `invalid class: ${node.class}`;
    }
    this.queries = QueryCount.array(node.queries ?? []);
  }
}

export class Edge {
  constructor(
    public start: Node,
    public goal: Node,
    public rules: Rule[] = [],
  ) {}
}

export class QueryCount {
  query: Query;
  count: number;
  statuses: Array<StatusCount>;
  error: Error;

  /**
   * Sets #error if the query cannot be converted to a link. Does not throw.
   */
  constructor(qc: api.QueryCount) {
    try {
      this.count = qc.count;
      this.query = Query.parse(qc.query);
    } catch (e) {
      this.error = e;
    }
    this.statuses = qc.statuses ?? [];
  }

  /** Highest count first, errors last */
  static compare(a: QueryCount, b: QueryCount): number {
    let d = (b.error ? 1 : 0) - (a.error ? 1 : 0);
    if (d === 0) d = b.count - a.count;
    return d;
  }

  static array(a: api.QueryCount[]): QueryCount[] {
    return (
      a?.map((qc: api.QueryCount): QueryCount => new QueryCount(qc))?.sort(QueryCount.compare) ?? []
    );
  }
}

export class Rule {
  name: string;
  queries: QueryCount[];

  constructor(r: api.Rule) {
    this.name = r.name;
    this.queries = QueryCount.array(r.queries);
  }

  static array(a: api.Rule[]) {
    return a?.map((r) => new Rule(r)) ?? [];
  }
}

export class Graph {
  nodes: Array<Node>;
  edges: Array<Edge>;

  private nodeByClass: Map<string, Node>;

  constructor(graph: api.Graph) {
    this.nodeByClass = new Map();
    this.nodes = (graph?.nodes ?? []).map((n) => {
      const node = new Node(n);
      this.nodeByClass[n.class] = node;
      return node;
    });
    this.edges = (graph?.edges ?? [])
      .map((e) => new Edge(this.node(e.start), this.node(e.goal), Rule.array(e.rules)))
      .filter((e) => e.start && e.goal);
  }

  node(id: string): Node {
    return this.nodeByClass[id];
  }
}
