import {
  PaginationParams,
  UseDataViewPaginationProps,
} from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { KeyboardEvent, MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { NavigateOptions, useSearchParams } from 'react-router';

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const useTablePagination = ({
  page = 1,
  perPage = 20,
  pageParam = PaginationParams.PAGE,
  perPageParam = PaginationParams.PER_PAGE,
}: UseDataViewPaginationProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = {
    page: parsePositiveInt(searchParams?.get(pageParam), page),
    perPage: parsePositiveInt(searchParams?.get(perPageParam), perPage),
  };

  const updateSearchParams = useCallback(
    (page: number, perPage: number, options?: NavigateOptions) => {
      setSearchParams?.((prev) => {
        const prevParams = new URLSearchParams(prev);
        prevParams.set(pageParam, `${page}`);
        prevParams.set(perPageParam, `${perPage}`);
        // Only update if there is a change in parameters to avoid unnecessary re-renders
        if (prev.toString() !== prevParams.toString()) {
          return prevParams;
        }
        return prev;
      }, options);
    },
    [setSearchParams, pageParam, perPageParam],
  );

  const onPerPageSelect = (
    _event: ReactMouseEvent | KeyboardEvent | MouseEvent | undefined,
    newPerPage: number,
  ) => {
    if (newPerPage !== state.perPage) {
      updateSearchParams(1, newPerPage);
    }
  };

  const setPage = (newPage: number, options?: NavigateOptions) => {
    if (newPage !== state.page) {
      updateSearchParams(newPage, state.perPage, options);
    }
  };

  const onSetPage = (
    _event: ReactMouseEvent | KeyboardEvent | MouseEvent | undefined,
    newPage: number,
  ) => setPage(newPage);

  return {
    ...state,
    onPerPageSelect,
    onSetPage,
    setPage,
  };
};
