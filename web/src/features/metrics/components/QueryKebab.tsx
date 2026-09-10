import { DropdownItem, Tooltip } from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import KebabDropdown from '@/shared/components/KebabDropdown';
import { DataTestIDs } from '@/shared/constants/data-test';

type QueryTableItem = string | number | { title?: string | { props?: { children?: unknown } } };

type QueryKebabProps = {
  canCreateAlert: boolean;
  isDisabledSeriesEmpty: boolean;
  isEnabled: boolean;
  onCreateAlert: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleAllSeries: () => void;
  onToggleIsEnabled: () => void;
  query?: string;
  queryTableData: { columns: QueryTableItem[]; rows: QueryTableItem[][] };
  text?: string;
};

export const QueryKebab: FC<QueryKebabProps> = ({
  canCreateAlert,
  isDisabledSeriesEmpty,
  isEnabled,
  onCreateAlert,
  onDelete,
  onDuplicate,
  onToggleAllSeries,
  onToggleIsEnabled,
  query,
  queryTableData,
  text,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const isSpan = (item: QueryTableItem): item is { title: { props: { children: unknown } } } =>
    typeof item === 'object' &&
    item !== null &&
    typeof item.title === 'object' &&
    item.title !== null &&
    Boolean(item.title.props?.children);
  const getSpanText = (item: { title: { props: { children: unknown } } }) =>
    item.title.props.children;

  // Takes data from QueryTable and removes/replaces all html objects from columns and rows
  const convertQueryTable = () => {
    const getColumns = () => {
      const columns = queryTableData.columns;
      const csvColumnHeaders = columns.slice(1).map((columnHeader) => {
        if (
          typeof columnHeader === 'object' &&
          columnHeader !== null &&
          typeof columnHeader.title === 'string'
        ) {
          return columnHeader.title;
        } else if (isSpan(columnHeader)) {
          return getSpanText(columnHeader);
        } else {
          return '';
        }
      });
      return csvColumnHeaders;
    };
    const getRows = () => {
      const rows = queryTableData.rows;
      const csvRows = rows
        .map((row) => row.slice(1))
        .map((row) =>
          row.map((rowItem) => {
            return isSpan(rowItem) ? getSpanText(rowItem) : rowItem;
          }),
        );
      return csvRows;
    };
    const tableData = [getColumns(), ...getRows()];
    return tableData;
  };

  const getCsv = (array: unknown[][], delimiter = ',') =>
    array
      .map((row) =>
        row.map((rowItem) => (isNaN(rowItem as number) ? `"${rowItem}"` : rowItem)).join(delimiter),
      )
      .join('\n');

  const downloadCsv = (csvData: string) => {
    // Modified from https://codesandbox.io/p/sandbox/react-export-to-csv-l6uhq?file=%2Fsrc%2FApp.jsx%3A39%2C10-39%2C16
    const blob = new Blob([csvData], { type: 'data:text/csv;charset=utf-8,' });
    const blobURL = window.URL.createObjectURL(blob);
    // Create new tag for download file
    const anchor = document.createElement('a');
    anchor.download = `OpenShift_Metrics_QueryTable_${query}.csv`;
    anchor.href = blobURL;
    anchor.dataset.downloadurl = ['text/csv', anchor.download, anchor.href].join(':');
    anchor.click();
    // Remove URL.createObjectURL. The browser should not save the reference to the file.
    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      URL.revokeObjectURL(blobURL);
    }, 100);
  };

  const doExportCsv = () => {
    const tableData = convertQueryTable();
    const csvData = getCsv(tableData);
    downloadCsv(csvData);
  };

  const exportDropdownItem = (
    <DropdownItem
      key="export"
      component="button"
      onClick={doExportCsv}
      data-test={DataTestIDs.MetricsPageExportCsvDropdownItem}
    >
      {t('Export as CSV')}
    </DropdownItem>
  );

  const isTextEmpty = !text || text.trim() === '';

  const createAlertItem = isTextEmpty ? (
    <Tooltip key="create-alert-disabled" position="left" content={t('Enter a query first')}>
      <DropdownItem
        isAriaDisabled={true} // need to receive focus for tooltip to work
        component="button"
        data-test={DataTestIDs.MetricsPageCreateAlertRuleDropdownItem}
      >
        {t('Create alert')}
      </DropdownItem>
    </Tooltip>
  ) : (
    <DropdownItem
      key="create-alert"
      component="button"
      onClick={onCreateAlert}
      data-test={DataTestIDs.MetricsPageCreateAlertRuleDropdownItem}
    >
      {t('Create alert')}
    </DropdownItem>
  );

  const defaultDropdownItems = [
    <DropdownItem
      key="toggle-query"
      component="button"
      onClick={onToggleIsEnabled}
      data-test={DataTestIDs.MetricsPageDisableEnableQueryDropdownItem}
    >
      {isEnabled ? t('Disable query') : t('Enable query')}
    </DropdownItem>,
    isEnabled ? (
      <DropdownItem
        key="toggle-all-series"
        component="button"
        onClick={onToggleAllSeries}
        data-test={DataTestIDs.MetricsPageHideShowAllSeriesDropdownItem}
      >
        {isDisabledSeriesEmpty ? t('Hide all series') : t('Show all series')}
      </DropdownItem>
    ) : (
      <Tooltip
        key="toggle-all-series-disabled"
        position="left"
        content={t('Query must be enabled')}
      >
        <DropdownItem
          isAriaDisabled={true} // need to receive focus for tooltip to work
          component="button"
        >
          {isDisabledSeriesEmpty ? t('Hide all series') : t('Show all series')}
        </DropdownItem>
      </Tooltip>
    ),
    <DropdownItem
      key="delete"
      component="button"
      onClick={onDelete}
      data-test={DataTestIDs.MetricsPageDeleteQueryDropdownItem}
    >
      {t('Delete query')}
    </DropdownItem>,
    <DropdownItem
      key="duplicate"
      component="button"
      onClick={onDuplicate}
      data-test={DataTestIDs.MetricsPageDuplicateQueryDropdownItem}
    >
      {t('Duplicate query')}
    </DropdownItem>,
  ];

  const hasQueryTableData = Boolean(query && queryTableData?.rows && queryTableData?.columns);

  const dropdownItems = [
    ...defaultDropdownItems,
    ...(canCreateAlert ? [createAlertItem] : []),
    ...(hasQueryTableData ? [exportDropdownItem] : []),
  ];

  return <KebabDropdown dropdownItems={dropdownItems} />;
};
