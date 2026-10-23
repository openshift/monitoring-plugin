import { Duration, Period, Unit, parseRange } from '../time';
import { Class, Constraint, Domain, Query, unixSeconds, URIRef } from './types';

// https://docs.openshift.com/container-platform/4.15/observability/network_observability/json-flows-format-reference.html
// Netflow URL parameter names are equivalent to the LogQL query labels, but spelled differently.
// Conversion of the most useful query names to URL parmameter name:
const queryToURLName = {
  DstK8S_Namespace: 'dst_namespace',
  DstK8S_OwnerName: 'dst_owner_name',
  DstK8S_Type: 'dst_kind',
  DstK8S_Zone: 'dst_zone',
  FlowDirection: 'node_direction',
  K8S_ClusterName: 'cluster_name',
  SrcK8S_Namespace: 'src_namespace',
  SrcK8S_OwnerName: 'src_owner_name',
  SrcK8S_Type: 'src_kind',
  SrcK8S_Zone: 'src_zone',
  _RecordType: 'type',
};

// Inverse conversion of URL parmameter names to LogQL query names.
const linkToQueryName = Object.entries(queryToURLName).reduce((result, [key, value]) => {
  result[value] = key;
  return result;
}, {});

export class NetflowDomain extends Domain {
  constructor() {
    super('netflow');
  }

  class(name: string): Class {
    if (name !== 'network') throw this.badClass(name);
    return new Class(this.name, name);
  }

  linkToQuery(link: URIRef): Query {
    if (!link.pathname.match(/netflow-traffic/)) throw this.badLink(link);
    let selectors = link.searchParams
      .get('filters')
      ?.split(';')
      .map((filter) => {
        const [, key, operator, value] = filter.match(/^\s*([^!=\s]+)\s*(!?=~?)\s*(.+)\s*$/) || [];

        if (!key || !linkToQueryName[key]) return '';

        // Check if value contains multiple comma-separated quoted strings like "val1","val2"
        const quotedValues = value?.match(/"([^"]+)"/g);
        if (quotedValues && quotedValues.length > 1) {
          // Extract the actual values (remove quotes)
          const values = quotedValues.map((v) => v.slice(1, -1));
          // Convert to LogQL regex syntax with OR operator
          return `${linkToQueryName[key]}=~"${values.join('|')}"`;
        }

        // Single value - removes surrounding quotes
        const trimmedValue = value?.replace(/^"(.*)"$/, '$1');
        return `${linkToQueryName[key]}${operator}"${trimmedValue}"`;
      })
      .filter((s) => s)
      .join(',');

    // Set default selector if no valid selectors are present
    selectors = selectors || 'DstK8S_Type="Pod",SrcK8S_Type="Pod"';
    return this.class('network').query(`{${selectors}}`);
  }

  queryToLink(query: Query, constraint?: Constraint): URIRef {
    if (query.class.name !== 'network') throw this.badQuery(query, 'unknown class');
    const filters = query.selector
      .match(/\s*\{\s*(.*)\s*\}\s*/)?.[1]
      ?.split(',')
      ?.map((filter: string) => {
        const [, key, operator, value] =
          filter.match(/^\s*([^!=\s]+)\s*(!?=~?)\s*"(.+)"\s*$/) || [];
        if (!key) throw this.badQuery(query, 'bad selector format');

        // Convert LogQL regex pattern to URL format for netflow
        if (queryToURLName[key]) {
          // If operator is =~ and value contains |, convert to comma-separated quoted format
          if (operator === '=~' && value.includes('|')) {
            const values = value
              .split('|')
              .map((v) => `"${v}"`)
              .join(',');
            return `${queryToURLName[key]}=${values}`;
          }
          return `${queryToURLName[key]}${operator}${value}`;
        }
        return '';
      })
      .filter((s) => s)
      .join(';');

    // Construct the base URL with required parameters
    let timeParams: { timeRange?: string; startTime?: string; endTime?: string };
    const period = constraint?.period;
    if (period) {
      const [start, end] = period.startEnd();
      if (Duration.isDuration(period)) {
        timeParams = {
          timeRange: String(Math.round(period.duration() / 1000)),
        };
      } else {
        timeParams = {
          startTime: String(unixSeconds(start)),
          endTime: String(unixSeconds(end)),
        };
      }
    }
    return new URIRef('netflow-traffic', {
      tenant: query.class.name,
      filters: filters ? filters : undefined,
      ...timeParams,
      limit: constraint?.limit,
    });
  }

  linkToPeriod(link: URIRef): Period | undefined {
    const timeRange = link.searchParams.get('timeRange');
    if (timeRange) {
      const seconds = Number(timeRange);
      return isNaN(seconds) ? undefined : new Duration(seconds, Unit.SECOND);
    }
    const startTime = link.searchParams.get('startTime');
    return parseRange(startTime, link.searchParams.get('endTime') || undefined, 1000);
  }
}
