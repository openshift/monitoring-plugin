import { QueryParams } from '@/shared/constants/query-params';

type UrlFilters<Key extends string> = { name: string } & Record<Key, string[]>;

export function parseFilterParams<Key extends string, Filters extends UrlFilters<Key>>(
  params: URLSearchParams,
  defaults: Filters,
  filterKeys: readonly Key[],
): Filters {
  const filters = { ...defaults, name: params.get(QueryParams.Name) ?? '' };

  filterKeys.forEach((key) => {
    filters[key] = params.getAll(key) as Filters[Key];
  });

  return filters;
}

export function serializeFilterParams<Key extends string>(
  current: URLSearchParams,
  filters: UrlFilters<Key>,
  filterKeys: readonly Key[],
): URLSearchParams {
  const next = new URLSearchParams(current);

  filterKeys.forEach((key) => {
    next.delete(key);
    filters[key].forEach((value) => next.append(key, value));
  });

  next.delete(QueryParams.Name);
  if (filters.name) {
    next.set(QueryParams.Name, filters.name);
  }

  return next;
}
