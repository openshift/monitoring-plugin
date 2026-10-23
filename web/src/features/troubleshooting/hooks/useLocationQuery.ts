import { useEffect, useMemo, useRef, useState } from 'react';
import { Query, URIRef } from '../korrel8r/types';
import { Period } from '../time';
import { useDomains } from './useDomains';

/** Get a snapshot of the current browser location */
const getLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

/**
 * Hook that tracks the browser location, reacting to all navigation changes.
 *
 * Uses requestAnimationFrame polling to detect URL changes rather than patching
 * history.pushState/replaceState, avoiding conflicts with other code that may
 * also intercept history methods (e.g. the console's router).
 *
 * react-router-dom-v5-compat's useLocation() doesn't update when the panel is
 * rendered via useModal(), because the modal may not receive router context updates.
 */
const useBrowserLocation = () => {
  const [location, setLocation] = useState(getLocation);
  const lastHref = useRef(window.location.href);

  useEffect(() => {
    let rafId: number;
    const check = () => {
      const href = window.location.href;
      if (href !== lastHref.current) {
        lastHref.current = href;
        setLocation(getLocation());
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return location;
};

/**
 * Returns the Korrel8r query and time period for the current browser location.
 * The period is resolved using the domain of the query, so each domain only
 * has to understand its own URL parameters.
 */
export const useLocationQuery = (): { query?: Query; period?: Period } => {
  const domains = useDomains();
  const location = useBrowserLocation();
  const lastLoggedError = useRef('');

  const { query, period, error } = useMemo(() => {
    try {
      const link = new URIRef(location.pathname + location.search);
      const query = domains.linkToQuery(link);
      const period = domains.get(query.class.domain).linkToPeriod(link);
      return { query, period };
    } catch (err) {
      return { error: String(err) };
    }
  }, [domains, location.pathname, location.search]);

  useEffect(() => {
    if (error && error !== lastLoggedError.current) {
      // eslint-disable-next-line no-console
      console.warn(`korrel8r useLocationQuery: ${error}`);
    }
    lastLoggedError.current = error ?? '';
  }, [error]);

  return { query, period };
};
