import { Duration, Period, Unit, parseRange } from '../time';
import { capitalize, Class, Constraint, Domain, Query, URIRef } from './types';

enum LogClass {
  application = 'application',
  infrastructure = 'infrastructure',
  audit = 'audit',
}

// TODO: Aggregated log links and k8s:pod style log queries ignore the containers parameter.

export class LogDomain extends Domain {
  constructor() {
    super('log');
  }

  classLabel(name: string): string {
    return capitalize(name) + ' Log';
  }

  class(name: string): Class {
    if (!LogClass[name]) throw this.badClass(name);
    return new Class(this.name, name);
  }

  linkToQuery(link: URIRef): Query {
    const logQL = link.searchParams.get('q');
    const logClassStr =
      link.searchParams.get('tenant') || logQL?.match(/{[^}]*log_type(?:=~?)"([^"]+)"/)?.at(1);
    const logClass = LogClass[logClassStr as keyof typeof LogClass];
    if (!logClass) throw this.badLink(link);
    return this.class(logClass).query(logQL);
  }

  queryToLink(query: Query, constraint?: Constraint): URIRef {
    const logClass = LogClass[query.class.name as keyof typeof LogClass];
    if (!logClass) throw this.badQuery(query, 'unknown class');
    const period = constraint?.period;
    const timeParams = period
      ? Duration.isDuration(period)
        ? { start: `now-${period.toString()}`, end: 'now' }
        : {
            start: String(period.startEnd()[0].getTime()),
            end: String(period.startEnd()[1].getTime()),
          }
      : { start: undefined, end: undefined };
    return new URIRef('monitoring/logs', {
      // Try to translate as a direct pod selector, otherwise use as logQL query
      q: addJSONFilter(directToLogQL(query.selector) || query.selector),
      tenant: logClass,
      ...timeParams,
    });
  }

  linkToPeriod(link: URIRef): Period | undefined {
    let startParam = link.searchParams.get('start');
    if (!startParam) return new Duration(1, Unit.HOUR); // Default
    if (startParam.startsWith('now-')) {
      startParam = startParam.slice(4);
    }
    const duration = Duration.parse(startParam);
    if (duration) return duration;

    return parseRange(startParam, link.searchParams.get('end') || undefined);
  }
}

// Add a JSON filter if not already present.
const addJSONFilter = (logQL: string) =>
  /\|\s*json\s*(\||$)/.test(logQL) ? logQL : `${logQL}|json`;

/**
 * Converts a string to a legal Loki label name by replacing illegal characters with underscores.
 * Loki label names must match the regex [a-zA-Z_:][a-zA-Z0-9_:]*
 * @param input - The input string to sanitize
 * @returns A sanitized string safe for use as a Loki label name
 */
export const cleanLokiLabel = (input: string): string => {
  if (!input) return '_';
  // Replace any character that's not alphanumeric, underscore, or colon with underscore
  const sanitized = input.replace(/[^a-zA-Z0-9_:]/g, '_');
  // Ensure the first character is valid (letter, underscore, or colon)
  if (!/^[a-zA-Z_:]/.test(sanitized)) {
    return '_' + sanitized;
  }
  return sanitized;
};

const directToLogQL = (maybeDirect: string): string | undefined => {
  try {
    // Try to parse the selector as k8s pod selector, and translate to logQL.
    const direct = JSON.parse(maybeDirect);
    if (!direct || typeof direct !== 'object') return undefined;
    const streams = [
      direct?.namespace && `kubernetes_namespace_name="${direct.namespace}"`,
      direct?.name && `kubernetes_pod_name="${direct.name}"`,
    ]
      .filter((x) => x)
      .join(',');
    const pipeline =
      direct?.labels && typeof direct.labels === 'object'
        ? Object.entries(direct.labels)
            .map(([k, v]) => `|kubernetes_labels_${cleanLokiLabel(k)}="${v}"`)
            .join('')
        : '';
    return `{${streams}}${pipeline ? '|json' + pipeline : ''}`;
  } catch {
    return undefined;
  }
};
