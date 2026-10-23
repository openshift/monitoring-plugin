import { Period, Range } from '../time';
import { Class, Constraint, Domain, Query, URIRef } from './types';

export class MetricDomain extends Domain {
  constructor() {
    super('metric');
  }

  class(name: string): Class {
    if (name !== this.name) throw this.badClass(name);
    return new Class(this.name, name);
  }

  linkToQuery(link: URIRef): Query {
    const promqlQuery = link.searchParams.get('query0');
    if (!promqlQuery) throw this.badLink(link);
    return new Query(this.class('metric'), promqlQuery);
  }

  queryToLink(query: Query, constraint?: Constraint): URIRef {
    query = this.checkQuery(query);
    if (!query.selector || query.selector.match(/{ *}/)) {
      throw this.badQuery(query, 'empty selector');
    }
    const period = constraint?.period;
    const [start, end] = period?.startEnd() ?? [];
    return new URIRef('monitoring/query-browser', {
      query0: query.selector,
      start: start ? String(start.getTime()) : undefined,
      end: end ? String(end.getTime()) : undefined,
    });
  }

  linkToPeriod(link: URIRef): Period | undefined {
    const startParam = link.searchParams.get('start');
    if (!startParam) return undefined;
    const start = new Date(Number(startParam));
    if (isNaN(start.getTime())) return undefined;
    const endParam = link.searchParams.get('end');
    const end = endParam ? new Date(Number(endParam)) : new Date();
    if (isNaN(end.getTime())) return undefined;
    return new Range(start, end);
  }
}
