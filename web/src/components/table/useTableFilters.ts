// Close to https://github.com/patternfly/react-data-view/blob/main/packages/module/src/Hooks/filters.ts
// but with changes to add/remove filter sets based on changing initialFilters, a bug fix for
// array filters, and changed to always sync URL

import { UseDataViewFiltersProps } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';

export const useTableFilters = <T extends object>({
  initialFilters = {} as T,
}: UseDataViewFiltersProps<T>) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<T>(() => {
    const filters = Object.keys(initialFilters).reduce(
      (loadedFilters, key) => {
        const isArrayFilter = Array.isArray(initialFilters[key]);
        let urlValue = isArrayFilter ? searchParams?.getAll(key) : searchParams?.get(key);
        if (Array.isArray(urlValue) && urlValue.length === 0) {
          urlValue = null;
        }

        loadedFilters[key] = urlValue
          ? isArrayFilter && !Array.isArray(urlValue)
            ? [urlValue]
            : urlValue
          : initialFilters[key];

        return loadedFilters;
      },
      { ...initialFilters },
    );
    return filters;
  });

  useEffect(() => {
    setSearchParams?.((prev) => {
      const params = new URLSearchParams(prev);
      Object.entries(filters).forEach(([key, value]) => {
        params.delete(key);
        (Array.isArray(value) ? value : [value]).forEach((val) => val && params.append(key, val));
      });
      return params;
    });
  }, [filters, setSearchParams]);

  const onSetFilters = useCallback((newFilters: Partial<T>) => {
    setFilters((prevFilters) => ({ ...prevFilters, ...newFilters }));
  }, []);

  // helper function to reset filters
  const resetFilterValues = useCallback(
    (filters: Partial<T>): Partial<T> =>
      Object.entries(filters).reduce((acc, [key, value]) => {
        if (Array.isArray(value)) {
          acc[key as keyof T] = [] as T[keyof T];
        } else {
          acc[key as keyof T] = '' as T[keyof T];
        }
        return acc;
      }, {} as Partial<T>),
    [],
  );

  const onDeleteFilters = useCallback(
    (filtersToDelete: Partial<T>) => {
      setFilters((prevFilters) => {
        const updatedFilters = { ...prevFilters, ...resetFilterValues(filtersToDelete) };
        return updatedFilters;
      });
    },
    [resetFilterValues],
  );

  const deleteFilter = useCallback(
    (filterToDelete: string) => {
      setFilters((prevFilters) => {
        return {
          ...prevFilters,
          ...resetFilterValues({ [filterToDelete]: prevFilters[filterToDelete] } as Partial<T>),
        };
      });
    },
    [resetFilterValues],
  );

  const clearAllFilters = useCallback(() => {
    setFilters((prevFilters) => {
      const clearedFilters = resetFilterValues(prevFilters) as T;
      return clearedFilters;
    });
  }, [resetFilterValues]);

  return {
    filters,
    onSetFilters,
    onDeleteFilters,
    clearAllFilters,
    deleteFilter,
  };
};
