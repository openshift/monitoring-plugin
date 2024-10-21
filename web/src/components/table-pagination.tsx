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
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <Trans t={t}>
      {/*
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO */}
      <b>
        {{ firstIndex }} - {{ lastIndex }}
      </b>{' '}
      {/*
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO */}
      of <b>{{ itemCount }}</b> {{ itemsTitle }}
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
  const { t } = useTranslation('plugin__monitoring-plugin');

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
        toFirstPageAriaLabel: t('Go to first page'),
        toPreviousPageAriaLabel: t('Go to previous page'),
        toLastPageAriaLabel: t('Go to last page'),
        toNextPageAriaLabel: t('Go to next page'),
        optionsToggleAriaLabel: t('Items per page'),
        currPageAriaLabel: t('Current page'),
        paginationAriaLabel: t('Pagination'),
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
