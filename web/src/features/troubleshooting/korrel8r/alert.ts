import { Class, Domain, Query, URIRef } from './types';

export class AlertDomain extends Domain {
  private nameToID: Map<string, string>;

  // Constructor takes an optional map of alert rule ID to name mappings.
  // Numeric IDs are used to refer to alerting rules with no alert parameters.
  constructor(private idToName: Map<string, string> = new Map()) {
    super('alert');
    this.nameToID = new Map(Array.from(idToName, ([key, value]) => [value, key]));
  }

  class(name: string): Class {
    if (name !== this.name) throw this.badClass(name);
    return new Class(this.name, name);
  }

  // Convert a Query to a relative URI reference.
  linkToQuery(link: URIRef): Query {
    const m = link.pathname.match(/monitoring\/(?:alerts|alertrules)(?:\/([^/]*))?/);
    if (!m) throw this.badLink(link);
    let selector = Object.fromEntries(link.searchParams);
    nonLabelParams.forEach((key: string) => delete selector[key]);
    // Set name from ID if not already set. Name can be undefined to search all alerts.
    selector['alertname'] ||= this.idToName.get(m?.[1]) || undefined;
    if (!selector['alertname']) selector = {}; // search all takes no other parameters
    return new Query(this.class('alert'), JSON.stringify(selector));
  }

  queryToLink(query: Query): URIRef {
    try {
      const selector = JSON.parse(query.selector);
      const id = this.nameToID.get(selector['alertname']);
      if (id && Object.keys(selector).length === 1) {
        // Selector only has [alertname], use the alert rule URL format.
        return new URIRef(`monitoring/alertrules/${id}`);
      }
      return new URIRef(`monitoring/alerts${id ? `/${id}` : ''}`, selector);
    } catch (e) {
      throw this.badQuery(query, e.toString());
    }
  }
}

// URL parameters that are not alert labels, remove them from the query.
const nonLabelParams = new Set<string>([
  'prometheus',
  'rowFilter-alert-state',
  'rowFilter-alert-source',
  'rowFilter-alerting-rule-source',
  'alert-state',
  'alert-source',
  'alerting-rule-source',
  'managed_cluster',
]);
