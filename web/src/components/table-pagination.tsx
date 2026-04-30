import {
  OnPerPageSelect,
  OnSetPage,
  Pagination,
  PaginationVariant,
  PerPageOptions,
} from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation, Trans } from 'react-i18next';

export const ITEMS_PER_PAGE = [10, 20, 50, 100, 200, 500];

const defaultPerPageOptions: PerPageOptions[] = ITEMS_PER_PAGE.map((n) => ({
  title: n.toString(),
  value: n,
}));

const LocalizedToggleTemplate = ({
  firstIndex,
  itemCount,
  itemsTitle,
  lastIndex,
}: LocalizedToggleTemplateProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Trans t={t} values={{ firstIndex, lastIndex, itemCount, itemsTitle }}>
      <b>
        {firstIndex} - {lastIndex}
      </b>{' '}
      of <b>{itemCount}</b> {itemsTitle}
    </Trans>
  );
};

export const TablePagination: FC<TablePaginationProps> = ({
  itemCount,
  page,
  perPage,
  perPageOptions = defaultPerPageOptions,
  setPage,
  setPerPage,
  variant = PaginationVariant.bottom,
  onSetPage,
  onPerPageSelect,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Pagination
      itemCount={itemCount}
      onPerPageSelect={
        onPerPageSelect
          ? onPerPageSelect
          : (e, v) => {
              // When changing the number of results per page,
              // keep the start row approximately the same
              const firstRow = (page - 1) * perPage;
              setPage(Math.floor(firstRow / v) + 1);
              setPerPage(v);
            }
      }
      onSetPage={onSetPage ? onSetPage : (e, v) => setPage(v)}
      page={page}
      perPage={perPage}
      perPageOptions={perPageOptions}
      variant={variant}
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
  setPage?: (page: number) => void;
  setPerPage?: (perPage: number) => void;
  variant?: 'top' | 'bottom' | PaginationVariant;
  onSetPage?: OnSetPage;
  onPerPageSelect?: OnPerPageSelect;
};
