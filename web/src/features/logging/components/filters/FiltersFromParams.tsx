import { Filters, Option } from '@/features/logging/components/filters/filter-types';

export const filtersFromParams = (
  queryParams: URLSearchParams,
  availableFilters: Set<string>,
): Filters => {
  const filters: Filters = {};

  Array.from(availableFilters).forEach((filterId) => {
    const value = queryParams.get(filterId);
    if (value) {
      filters[filterId] = new Set(value.split(','));
    }
  });

  return filters;
};

export const isOption = (option: unknown): option is Option =>
  (option as Option).value !== undefined && (option as Option).option !== undefined;
