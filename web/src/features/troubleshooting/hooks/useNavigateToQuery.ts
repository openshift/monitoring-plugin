import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import * as korrel8r from '../korrel8r/types';
import { useDomains } from './useDomains';

/**
 * Custom hook for navigating from Korrel8r queries to console web pages.
 * @returns A function to navigate to a query with given constraints
 */
export const useNavigateToQuery = () => {
  const navigate = useNavigate();
  const domains = useDomains();

  const navigateToQuery = useCallback(
    (query: korrel8r.Query, constraint: korrel8r.Constraint) => {
      try {
        let link = domains.queryToLink(query, constraint)?.toString();
        if (!link) return;
        if (!link.startsWith('/')) link = '/' + link;
        navigate(link);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`korrel8r navigateToQuery: ${e}`);
      }
    },
    [navigate, domains],
  );

  return navigateToQuery;
};
