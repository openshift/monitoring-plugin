import { Pagination, PaginationVariant, PerPageOptions } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation, Trans } from 'react-i18next';

const defaultPerPageOptions: PerPageOptions[] = [10, 20, 50, 100, 200, 500].map((n) => ({
  title: n.toString(),
  value: n,
}));

const LocalizedToggleTemplate: React.FC<LocalizedToggleTemplateProps> = ({
  firstIndex,
  itemCount,
  itemsTitle,
  lastIndex,
}) => {
  const { t } = useTranslation('public');

  return (
    <Trans t={t}>
      <b>
        <>
          {{ firstIndex }} - {{ lastIndex }}
        </>
      </b>{' '}
      of{' '}
      <b>
        <>{{ itemCount }}</>
      </b>{' '}
      {{ itemsTitle }}
    </Trans>
  );
};

const TablePagination: React.FC<TablePaginationProps> = ({
  itemCount,
  page,
  perPage,
  perPageOptions = defaultPerPageOptions,
  setPage,
  setPerPage,
}) => {
  const { t } = useTranslation('public');

  const onPerPageSelect = (e, v) => {
    // When changing the number of results per page, keep the start row approximately the same
    const firstRow = (page - 1) * perPage;
    setPage(Math.floor(firstRow / v) + 1);
    setPerPage(v);
  };

  return (
    <Pagination
      itemCount={itemCount}
      onPerPageSelect={onPerPageSelect}
      onSetPage={(e, v) => setPage(v)}
      page={page}
      perPage={perPage}
      perPageOptions={perPageOptions}
      variant={PaginationVariant.bottom}
      toggleTemplate={LocalizedToggleTemplate}
      titles={{
        items: '',
        page: '',
        itemsPerPage: t('Items per page'),
        perPageSuffix: t('per page'),
        toFirstPage: t('Go to first page'),
        toPreviousPage: t('Go to previous page'),
        toLastPage: t('Go to last page'),
        toNextPage: t('Go to next page'),
        optionsToggle: t('Items per page'),
        currPage: t('Current page'),
        paginationTitle: t('Pagination'),
        ofWord: t('of'),
      }}
    />
  );
};

type LocalizedToggleTemplateProps = {
  firstIndex: number;
  itemCount: number;
  itemsTitle: string;
  lastIndex: number;
};

type TablePaginationProps = {
  itemCount: number;
  page: number;
  perPage: number;
  perPageOptions?: PerPageOptions[];
  setPage: (number) => void;
  setPerPage: (number) => void;
};

export default TablePagination;
