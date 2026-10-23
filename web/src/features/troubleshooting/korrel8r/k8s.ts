import { getCachedResources } from '../getResources';
import { capitalize, Class, Domain, Query, URIRef, keyValueList } from './types';

// k8s model type stored in browser cache.
type Model = {
  kind: string;
  apiVersion: string;
  apiGroup: string;
  path: string;
  verbs: string[];
};

// Parsed form of a k8s query selector.
export type Selector = {
  name?: string;
  namespace?: string;
  labels?: { [key: string]: string };
  fields?: { [key: string]: string };
};

const pathRE = new RegExp(
  '(?<prefix>k8s|search|api-resource)' + // prefix
    '/((ns/(?<namespace>[^/]+))|cluster|all-namespaces)' + // /namespace
    '(/(?<resource>[^/]+)(/(?<name>([^/]+))(?<events>/events)?)?)?', // [/resource[/name[/events]]]
);

const versionRE = /(?<version>v[0-9]+((alpha|beta)[0-9]*)?)/;
const classRE = new RegExp(`^(?<kind>[^./]+)(\\.${versionRE.source})?(.(?<group>[^/]*))?$`);

export class K8sDomain extends Domain {
  constructor() {
    super('k8s');
  }

  classLabel(name: string): string {
    return capitalize(name.replace(/\..*$/, ''));
  }

  class(name: string): Class {
    const model = this.classModel(name);
    if (!model) throw this.badClass(name);
    return this.modelClass(model);
  }

  private classModel(name: string): Model | undefined {
    const g = name.match(classRE)?.groups;
    if (!g) return;
    return findGVK(g.group, g.version, g.kind);
  }

  private modelClass(model: Model): Class {
    const version = model.apiVersion || 'v1';
    const dotGroup = model.apiGroup ? `.${model.apiGroup}` : '';
    return new Class(this.name, `${model.kind}.${version}${dotGroup}`);
  }

  linkToQuery(link: URIRef): Query {
    const g = link.pathname.match(pathRE)?.groups;
    if (!g) throw this.badLink(link);
    const resource = g.resource || link.searchParams.get('kind');
    const model = findResource(resource);
    if (!model?.kind) throw this.badLink(link, `unknown resource: ${resource}`);
    // api-resource is a resource type not a named instance, ignore the name part of the URL.
    const name = g.prefix === 'api-resource' ? undefined : g.name;
    if (g.events) {
      // Special case for /events, query for events with this resource as involved object
      const event = eventModel();
      const about = eventAboutField(event);
      const apiVersion = `${model.apiGroup ? `${model.apiGroup}/` : ''}${model.apiVersion || 'v1'}`;
      const data = {
        fields: {
          [`${about}.namespace`]: g.namespace,
          [`${about}.name`]: name,
          [`${about}.apiVersion`]: apiVersion,
          [`${about}.kind`]: model.kind,
        },
      };
      return this.modelClass(event).query(JSON.stringify(data));
    } else {
      const data = {
        namespace: g.namespace,
        name,
        labels: K8sDomain.parseSelector(link.searchParams.get('label')) || undefined,
      };
      return this.modelClass(model).query(JSON.stringify(data));
    }
  }

  // NOTE: k8s queries don't support query constraints, so neither do console k8s URIs.
  queryToLink(query: Query): URIRef {
    let selector: Selector;
    try {
      selector = JSON.parse(query.selector) as Selector;
    } catch (e) {
      throw this.badQuery(query, e.message);
    }
    let model = this.classModel(query.class.name);
    if (!model) throw this.badQuery(query, `no resources match class`);
    let namespace = selector.namespace;
    let name = selector.name;
    let events = '';
    if (isEvent(model) && selector.fields) {
      // Special case for events, generate URL of involved object with '/events' modifier.
      // Only apply this if fields are present (indicating an event about a specific object).
      const eventClass = this.modelClass(model);
      const about = eventAboutField(model);
      const apiVersion = selector.fields[`${about}.apiVersion`];
      const kind = selector.fields[`${about}.kind`];
      // Only treat as an involved object event if the required fields are present
      if (apiVersion && kind) {
        const [group, version] = parseAPIVersion(apiVersion);
        model = findGVK(group, version, kind);
        if (!model) throw this.badQuery(query, `no resource matching ${eventClass}.${about}`);
        namespace = selector.fields[`${about}.namespace`] || '';
        name = selector.fields[`${about}.name`] || '';
        events = '/events';
      }
    }
    // Prepare parts of the URL
    const nsPath = namespace ? `ns/${namespace}` : 'all-namespaces';
    const kind = `${model.apiGroup || 'core'}~${model.apiVersion}~${model.kind}`;
    const params = {
      label: keyValueList(selector.labels) || undefined,
      fields: (!events && keyValueList(selector.fields)) || undefined,
    };
    if (!name && !namespace && (params.label || params.fields)) {
      // Search URL
      return new URIRef(`search/${nsPath}`, { ...params, kind });
    } else {
      // Specific resource URL
      return new URIRef(`k8s/${nsPath}/${kind}${name ? `/${name}` : ''}${events}`, { ...params });
    }
  }

  // parseSelector parses a selector string as a query map.
  static parseSelector(selector: string): { [key: string]: string } {
    if (!selector) return;
    const labels: { [key: string]: string } = {};
    selector.split(',').forEach((pair: string) => {
      const [key, value] = pair.split(/=(.*)/);
      labels[key] = value;
    });
    return labels || undefined;
  }
}

// Original k8s Event resource was in the core group, modern Event is in the events.k8s.io group.
// Event.v1 has an 'involvedObject' field, Event.v1.events.k8s.io has a 'regarding' field.
// Need to handle both variations.
const EVENT = {
  group: 'events.k8s.io',
  version: 'v1',
  kind: 'Event',
};

function isEvent(m: Model): boolean {
  return (
    m.kind == EVENT.kind &&
    m.apiVersion == EVENT.version &&
    (!m.apiGroup || m.apiGroup === EVENT.group)
  );
}

// Returns an event resource model that is supported by the cluster.
// Prefer the older version as there are still many older clusters out there.
function eventModel(): Model {
  return findGVK('', EVENT.version, EVENT.kind) || findGVK(EVENT.group, EVENT.version, EVENT.kind);
}

function eventAboutField(m: Model): string {
  return m?.apiGroup === EVENT.group ? 'regarding' : 'involvedObject';
}

// Find the cached resource model for a GVK. Same defaulting rules as korrel8r.
function findGVK(group: string, version: string, kind: string): Model {
  version = version || 'v1';
  group = group || '';
  return getCachedResources()?.models.find(
    (m: Model) =>
      m.kind === kind &&
      m.verbs.includes('watch') &&
      m.apiVersion === version &&
      (m.apiGroup || '') === group,
  );
}

// Return a model for the resource, can be G~V~K or path. Return undefined if not found.
function findResource(resource: string): Model {
  if (!resource) return;
  // Try as a G~V~K string
  const [g, v, k] = resource.split('~');
  if (k) return findGVK(g === 'core' ? '' : g, v, k);
  // Try as a bare Kind
  const m = findGVK('', 'v1', resource);
  if (m) return m;
  // Try as a resource path
  if (resource === 'projects') resource = 'namespaces'; // Alias
  let found: Model;
  for (const m of getCachedResources()?.models || []) {
    if (m.path === resource && m.verbs.includes('watch')) {
      if (!m.apiGroup) return m; // Prefer core models
      found = found || m;
    }
  }
  return found;
}

function parseAPIVersion(apiVersion: string): [group: string, version: string] | undefined {
  const gv = apiVersion?.split('/') || [];
  switch (gv.length) {
    case 1:
      return gv[0].match(versionRE) ? ['', gv[0]] : [gv[0], ''];
    case 2:
      return [gv[0], gv[1]];
    default:
      return ['', ''];
  }
}
