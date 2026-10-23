import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';

export class HttpError extends Error {
  retryAfter?: number; // milliseconds
  constructor(
    public status: number,
    statusText: string,
    retryAfter?: number,
  ) {
    super(`${status} ${statusText}`);
    this.retryAfter = retryAfter;
  }
}

// Parse a Retry-After HTTP header value, return milliseconds.
// Documentation: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After
const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
};

export const retryDelay = (err: unknown, backoff: number): number =>
  err instanceof HttpError && err.retryAfter !== undefined ? err.retryAfter : backoff;

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  listDomains as clientListDomains,
  Console,
  consoleEvents,
  Goals,
  Graph,
  graphGoals,
  graphNeighbors,
  Neighbors,
  setConsole,
  Start,
} from './korrel8r/client';
import { Config, createClient } from './korrel8r/client/client';
import * as korrel8r from './korrel8r/types';

import { useTranslation } from 'react-i18next';
import { Search, SearchType } from './redux-actions';

// Result displayed in troubleshooting panel, graph or message.
export type GraphResult = {
  graph?: korrel8r.Graph; // Successful result
  constraint?: korrel8r.Constraint; // Window actually sent with this request
  title?: string; // Title when there is no graph.
  message?: string; // Message when there is no graph.
};

export const listDomains = (signal: AbortSignal) => {
  return clientListDomains({ client: korrel8rClient({ signal }) });
};

const graphQuery = { options: { rules: true } };

const getNeighborsGraph = (neighbours: Neighbors, signal: AbortSignal) => {
  return graphNeighbors({
    client: korrel8rClient({ signal }),
    body: neighbours,
    query: graphQuery,
  });
};

const getGoalsGraph = (goals: Goals, signal: AbortSignal) => {
  return graphGoals({ client: korrel8rClient({ signal }), body: goals, query: graphQuery });
};

export const sendConsoleUpdate = (body: Console, signal: AbortSignal) => {
  return setConsole({ client: korrel8rClient({ signal }), body });
};

export const getConsoleUpdates = (
  signal: AbortSignal,
  callbacks: { onSseError?: (error: unknown) => void; onConnect?: () => void } = {},
) => {
  const connectFetch = async (req: Request): Promise<Response> => {
    let response: Response;
    try {
      response = await requestWrapper(req);
    } catch (err) {
      // consoleFetch throws its own HttpError with a `code` property; convert to ours.
      const code = (err as { code?: unknown }).code;
      throw typeof code === 'number' ? new HttpError(code, String(err)) : err;
    }
    if (!response.ok) {
      throw new HttpError(
        response.status,
        response.statusText,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    callbacks.onConnect?.();
    return response;
  };
  // Cast: SSE options are supported by the runtime but not exposed in the generated Options type.
  // Disable SSE retries: useAgentNavigation has its own reconnect loop that
  // manages error state and re-sends console state on reconnection.
  return consoleEvents({
    client: korrel8rClient({ signal, fetch: connectFetch as typeof fetch }),
    sseMaxRetryAttempts: 1,
    onSseError: callbacks.onSseError,
  } as Parameters<typeof consoleEvents>[0]);
};

export const useKorrel8rGraph = ({
  search,
}: {
  search: Search;
}): UseQueryResult<GraphResult, Error> => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');

  const queryStr = search?.queryStr;

  return useQuery({
    queryKey: ['korrel8r', 'graph', search],
    queryFn: async ({ signal }) => {
      const constraint = new korrel8r.Constraint({
        period: search.period,
        limit: search.limit,
      });
      const start: Start = {
        queries: [queryStr],
        constraint: constraint.toAPI(),
      };
      const fetch =
        search.searchType === SearchType.Goal
          ? getGoalsGraph({ start, goals: [search.goal] }, signal)
          : getNeighborsGraph({ start, depth: search.depth }, signal);
      return fetch.then(({ data }: { data: Graph }) => {
        return Array.isArray(data?.nodes) && data.nodes.length > 0
          ? { graph: new korrel8r.Graph(data), constraint }
          : { title: t('No correlated signals found'), constraint };
      });
    },
    enabled: validRequest(search),
    staleTime: 10 * 60 * 1000,
  });
};

const validRequest = (search: Search) => {
  if (!search?.queryStr) {
    return false;
  }
  if (search.searchType === SearchType.Goal) {
    return !!search.goal;
  }
  return !!search.depth;
};

const requestWrapper = async (req: Request) => {
  const url = new URL(req.url);
  // The Request object creates a rule with the full url, ie. https://console.openshift/korrel8r/path?q=a
  // However if the host is included in the url passed into consoleFetch then the
  // CSRF header will not be added, so we need to remove the host from the first parameter
  // which is done by adding the pathname and search together
  return consoleFetch(url.pathname + url.search, await initRequest(req));
};

/**
 * This function converts a Request to a RequestInit object
 *
 * Notably it converts a Header object into an object which can be passed in to initiate
 * a HeaderInit object, and clones the request body manually since the body field in
 * a Request object becomes locked
 */
const initRequest = async (req: Request): Promise<RequestInit> => {
  const init = {
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
    mode: req.mode,
    credentials: req.credentials,
    cache: req.cache,
    redirect: req.redirect,
    integrity: req.integrity,
    keepalive: req.keepalive,
    signal: req.signal,
  };
  const body = await req.clone().text();

  if (body) {
    init['body'] = body;
  }
  return init;
};

const defaultConfig = {
  baseUrl: '/api/proxy/plugin/troubleshooting-panel-console-plugin/korrel8r/api/v1alpha1',
  headers: { Accept: 'application/json' },
  fetch: requestWrapper,
  throwOnError: true,
};

const korrel8rClient = (config: Config) => createClient({ ...defaultConfig, ...config });
