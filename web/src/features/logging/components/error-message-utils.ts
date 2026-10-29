import {
  ResourceLabel,
  ResourceToStreamLabels,
} from '@/features/logging/components/ParseResources';
import { LabelMatcher, LogQLQuery } from '@/features/logging/utils/logql-query';
import { removeQuoteWrapper } from '@/features/logging/utils/value-utils';

export type ForbiddenKind = 'none' | 'namespace-selected' | 'no-namespace' | 'audit';

// Both schemas' namespace labels: a custom query may use either, regardless of
// the plugin's selected schema.
const NAMESPACE_LABELS = [
  ResourceToStreamLabels[ResourceLabel.Namespace].otel,
  ResourceToStreamLabels[ResourceLabel.Namespace].viaq,
];

// != / !~ exclude one namespace but admit all others, so they don't scope the query.
const NAMESPACE_EXCLUSION_OPERATORS = ['!=', '!~'];

// A =~ regex that matches every namespace (.*, .+, with optional lazy ? and
// anchors) selects all of them, so it doesn't scope the query. Best-effort: this
// covers the common hand-typed catch-alls, not every equivalent pattern.
const CATCH_ALL_NAMESPACE_REGEX = /^\^?\.[*+]\??\$?$/;

const isNamespaceMatcher = (matcher: LabelMatcher): boolean => {
  if (
    matcher.label === undefined ||
    !NAMESPACE_LABELS.includes(matcher.label) ||
    matcher.operator === undefined ||
    NAMESPACE_EXCLUSION_OPERATORS.includes(matcher.operator) ||
    matcher.value === undefined
  ) {
    return false;
  }

  const value = removeQuoteWrapper(matcher.value).trim();
  if (value === '') {
    return false;
  }

  if (matcher.operator === '=~' && CATCH_ALL_NAMESPACE_REGEX.test(value)) {
    return false;
  }

  return true;
};

// Audit logs have no namespace label, so namespace scoping is neither possible nor
// a remedy for a 403 there.
const TENANT_WITHOUT_NAMESPACE = 'audit';

export const queryHasNamespaceFilter = (query: string | undefined, tenant?: string): boolean => {
  // Report audit queries as scoped so a forbidden audit response shows the generic
  // permission error instead of the (unresolvable) "select a namespace" prompt.
  if (tenant === TENANT_WITHOUT_NAMESPACE) {
    return true;
  }

  if (!query) {
    return false;
  }

  const parsedQuery = new LogQLQuery(query);

  return (
    parsedQuery.streamSelectors.length > 0 &&
    parsedQuery.streamSelectors.every((selector) => selector.some(isNamespaceMatcher))
  );
};

export const getForbiddenKind = (
  status: number | undefined,
  hasNamespaceFilter: boolean | undefined,
  tenant?: string,
): ForbiddenKind => {
  if (status !== 403) {
    return 'none';
  }

  if (tenant === TENANT_WITHOUT_NAMESPACE) {
    return 'audit';
  }

  return hasNamespaceFilter === false ? 'no-namespace' : 'namespace-selected';
};
