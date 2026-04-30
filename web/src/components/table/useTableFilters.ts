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

  const getInitialFilters = useCallback((): T => {
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
  }, [initialFilters, searchParams]);
  const [filters, setFilters] = useState<T>(getInitialFilters());

  const updateSearchParams = useCallback(
    (newFilters: T) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(newFilters).forEach(([key, value]) => {
        params.delete(key);
        (Array.isArray(value) ? value : [value]).forEach((val) => val && params.append(key, val));
      });
      setSearchParams?.(params);
    },
    [searchParams, setSearchParams],
  );

  const onSetFilters = useCallback(
    (newFilters: Partial<T>) => {
      setFilters((prevFilters) => {
        const updatedFilters = { ...prevFilters, ...newFilters };
        updateSearchParams(updatedFilters);
        return updatedFilters;
      });
    },
    [updateSearchParams],
  );

  // Initialize filters from URL parameters on mount only
  useEffect(() => {
    onSetFilters(getInitialFilters());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        updateSearchParams(updatedFilters);
        return updatedFilters;
      });
    },
    [updateSearchParams, resetFilterValues],
  );

  const deleteFilter = useCallback(
    (filterToDelete: string) => {
      setFilters((prevFilters) => {
        const updatedFilters = { ...prevFilters };
        delete updatedFilters[filterToDelete];
        updateSearchParams(updatedFilters);
        return updatedFilters;
      });
    },
    [updateSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    setFilters((prevFilters) => {
      const clearedFilters = resetFilterValues(prevFilters) as T;
      updateSearchParams(clearedFilters);
      return clearedFilters;
    });
  }, [updateSearchParams, resetFilterValues]);

  return {
    filters,
    onSetFilters,
    onDeleteFilters,
    clearAllFilters,
    deleteFilter,
  };
};
