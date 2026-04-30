import {
  PaginationParams,
  UseDataViewPaginationProps,
} from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

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

  const [state, setState] = useState({
    page: parsePositiveInt(searchParams?.get(pageParam), page),
    perPage: parsePositiveInt(searchParams?.get(perPageParam), perPage),
  });

  const updateSearchParams = useCallback(
    (page: number, perPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set(pageParam, `${page}`);
      params.set(perPageParam, `${perPage}`);

      setSearchParams?.(params);
    },
    [searchParams, setSearchParams, pageParam, perPageParam],
  );

  useEffect(() => {
    // Make sure search params are loaded or set if not present on mount
    updateSearchParams(state.page, state.perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Listen on URL params changes
    const currentPage = parseInt(searchParams?.get(pageParam) || `${state.page}`);
    const currentPerPage = parseInt(searchParams?.get(perPageParam) || `${state.perPage}`);
    if (currentPage !== state.page || currentPerPage !== state.perPage) {
      setState({ page: currentPage, perPage: currentPerPage });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.toString()]);

  const onPerPageSelect = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent | undefined,
    newPerPage: number,
  ) => {
    if (newPerPage !== state.perPage) {
      updateSearchParams(1, newPerPage);
      setState({ perPage: newPerPage, page: 1 });
    }
  };

  const onSetPage = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent | undefined,
    newPage: number,
  ) => {
    if (newPage !== state.page) {
      updateSearchParams(newPage, state.perPage);
      setState((prev) => ({ ...prev, page: newPage }));
    }
  };

  return {
    ...state,
    onPerPageSelect,
    onSetPage,
  };
};
