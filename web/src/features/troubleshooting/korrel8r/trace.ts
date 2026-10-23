import { Duration, Period, parseRange } from '../time';
import { Class, Constraint, Domain, Query, URIRef } from './types';

// URL formats:
// Get all spans in a single trace:
//   observe/traces/<trace-id>
// Search for get selected spans
//   observe/traces/?namespace=<tempoNamespace>&name=<tempoName>&tenant=<tempoTenant>&q=<traceQL>

// TODO hard-coded tempo location, need to make this configurable between console & korrel8r.
// Get from the console page environment (change from using URL as context?)
const [tempoNamespace, tempoName, tempoTenant] = ['openshift-tracing', 'platform', 'platform'];

export class TraceDomain extends Domain {
  constructor() {
    super('trace');
  }

  class(name: string): Class {
    if (name !== 'span') throw this.badClass(name);
    return new Class(this.name, name);
  }

  linkToQuery(link: URIRef): Query {
    const m = link.pathname.match(/observe\/traces(?:\/([0-9a-fA-F]{32})\/?)?$/);
    if (!m) throw this.badLink(link);
    const traceQL = m[1] ? `{trace:id="${m[1]}"}` : link.searchParams.get('q') || '{}';
    return this.class('span').query(traceQL);
  }

  queryToLink(query: Query, constraint?: Constraint): URIRef {
    this.checkQuery(query);
    const traceQL = query.selector;
    const traceID = traceQL.match(/\{ *trace:id *= *"([0-9a-fA-F]{32})" *\}/)?.[1] || '';
    const period = constraint?.period;
    let timeParams: { start?: string; end?: string };
    if (period) {
      if (Duration.isDuration(period)) {
        timeParams = { start: period.toString() };
      } else {
        const [start, end] = period.startEnd();
        timeParams = { start: String(start.getTime()), end: String(end.getTime()) };
      }
    }
    return new URIRef(`observe/traces${traceID ? `/${traceID}` : ''}`, {
      namespace: tempoNamespace,
      name: tempoName,
      tenant: tempoTenant,
      q: !traceID && !traceQL.match(/{[:space:]*}/) && traceQL,
      ...timeParams,
    });
  }

  linkToPeriod(link: URIRef): Period | undefined {
    const startParam = link.searchParams.get('start');
    if (!startParam) return undefined;
    const duration = Duration.parse(startParam);
    if (duration) return duration;

    return parseRange(startParam, link.searchParams.get('end') || undefined);
  }
}
