import {
  PaginationParams,
  UseDataViewPaginationProps,
} from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { useCallback, useState } from 'react';
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
      setSearchParams?.((prev) => {
        const prevParams = new URLSearchParams(prev);
        prevParams.set(pageParam, `${page}`);
        prevParams.set(perPageParam, `${perPage}`);
        // Only update if there is a change in parameters to avoid unnecessary re-renders
        if (prev.toString() !== prevParams.toString()) {
          return prevParams;
        }
        return prev;
      });
    },
    [setSearchParams, pageParam, perPageParam],
  );

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
