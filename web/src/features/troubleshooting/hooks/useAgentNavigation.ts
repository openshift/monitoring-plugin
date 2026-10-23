import * as React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { getConsoleUpdates, retryDelay, sendConsoleUpdate } from '../korrel8r-client';
import * as api from '../korrel8r/client';
import { Query } from '../korrel8r/types';
import {
  defaultSearch,
  openTP,
  Search,
  SearchType,
  setAgentConnected,
  setAgentError,
  setAgentToast,
  setSearch,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { sleep } from '../sleep';
import { useDomains } from './useDomains';
import { useLocationQuery } from './useLocationQuery';
import { useNavigateToQuery } from './useNavigateToQuery';

const errorMessage = (err: unknown): string => (err as Error)?.message || String(err);

const useAgentNavigation = ({
  minDelay = 500,
  maxDelay = 10000,
}: { minDelay?: number; maxDelay?: number } = {}) => {
  const agentEnabled: boolean = useSelector((s: State) => s.plugins?.tp?.get('agentEnabled'));
  const view = useLocationQuery().query?.toString();
  const search: Search = useSelector((s: State) => s.plugins?.tp?.get('search'), shallowEqual);
  const isOpen: boolean = useSelector((s: State) => s.plugins?.tp?.get('isOpen'));
  const dispatch = useDispatch();
  const domains = useDomains();
  const navigateToQuery = useNavigateToQuery();

  const navigateToQueryRef = React.useRef(navigateToQuery);
  const domainsRef = React.useRef(domains);
  React.useEffect(() => {
    navigateToQueryRef.current = navigateToQuery;
    domainsRef.current = domains;
  });

  // Handle console update events via an SSE stream.
  // Endless loop to stay constantly connected to the agent.
  React.useEffect(() => {
    if (!agentEnabled) {
      dispatch(setAgentConnected(false));
      return;
    }

    const controller = new AbortController();
    const consumeStream = async () => {
      let backoff = minDelay;
      while (!controller.signal.aborted) {
        let lastError: unknown;
        try {
          const result = await getConsoleUpdates(controller.signal, {
            onConnect: () => {
              backoff = minDelay;
              dispatch(setAgentConnected(true));
              dispatch(setAgentError(''));
            },
            onSseError: (err: unknown) => {
              lastError = err;
            },
          });
          for await (const event of result.stream) {
            if (controller.signal.aborted) return;
            const eventSearch = event.search && fromAPISearch(event.search);
            let parsedQuery: Query | undefined;
            try {
              const queryStr = event.view || eventSearch?.queryStr;
              if (queryStr) parsedQuery = Query.parse(queryStr);
            } catch {
              // ignore unparseable queries
            }
            if (event.view) {
              navigateToQueryRef.current(parsedQuery || Query.parse(event.view), null);
            }
            if (eventSearch) {
              dispatch(setSearch(eventSearch));
              dispatch(openTP());
            }
            if (parsedQuery) {
              dispatch(setAgentToast(domainsRef.current.classLabel(parsedQuery.class)));
            } else if (event.view || eventSearch?.queryStr) {
              dispatch(setAgentToast((event.view || eventSearch?.queryStr) as string));
            }
          }
        } catch (err) {
          lastError = err;
        }
        if (controller.signal.aborted) return;
        dispatch(setAgentConnected(false));
        if (lastError) {
          dispatch(setAgentError(errorMessage(lastError)));
        }
        await sleep(retryDelay(lastError, backoff), controller.signal);
        backoff = Math.min(backoff * 2, maxDelay);
      }
    };
    consumeStream();
    return () => controller.abort();
  }, [agentEnabled, minDelay, maxDelay, dispatch]);

  // Send console updates when local view or search changes, or on connect.
  // Sends even when view/search are empty to signal that the console is connected.
  const agentConnected: boolean = useSelector((s: State) => s.plugins?.tp?.get('agentConnected'));
  React.useEffect(() => {
    if (!agentConnected) return;
    const controller = new AbortController();
    const sendWithRetry = async () => {
      let backoff = minDelay;
      while (!controller.signal.aborted) {
        try {
          await sendConsoleUpdate(
            { view, search: isOpen ? toAPISearch(search) : undefined },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          dispatch(setAgentError(''));
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          dispatch(setAgentError(errorMessage(err)));
          await sleep(retryDelay(err, backoff), controller.signal);
          backoff = Math.min(backoff * 2, maxDelay);
        }
      }
    };
    sendWithRetry();
    return () => controller.abort();
  }, [view, search, isOpen, agentConnected, minDelay, maxDelay, dispatch]);
};

export default useAgentNavigation;

export const toAPISearch = (search: Search): api.Search | undefined => {
  if (!search?.queryStr) return undefined;
  const start: api.Start = { queries: [search.queryStr] };
  if (search.limit) {
    start.constraint = { limit: search.limit };
  }
  switch (search.searchType) {
    case SearchType.Goal:
      return { goals: { start, goals: [search.goal] } };
    case SearchType.Depth:
      return { neighbors: { start, depth: search.depth } };
    default:
      return undefined;
  }
};

export const fromAPISearch = (search: api.Search): Search | undefined => {
  if (search.goals && search.neighbors) return undefined; // Invalid to  set both
  let result: Search | undefined;
  if (search.goals) {
    result = {
      queryStr: search.goals.start?.queries?.[0],
      searchType: SearchType.Goal,
      goal: search.goals.goals?.[0],
      limit: search.goals.start?.constraint?.limit,
    };
  } else if (search.neighbors) {
    result = {
      queryStr: search.neighbors.start?.queries?.[0],
      searchType: SearchType.Depth,
      depth: search.neighbors.depth || defaultSearch.depth,
      limit: search.neighbors.start?.constraint?.limit,
    };
  }
  return result?.queryStr ? result : undefined;
};
