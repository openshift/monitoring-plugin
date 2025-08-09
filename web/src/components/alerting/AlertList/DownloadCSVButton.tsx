import { Button, ButtonVariant } from '@patternfly/react-core';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerspective } from '../../hooks/usePerspective';
import { AggregatedAlert } from '../AlertsAggregates';
import { AlertsPageTestIDs } from '../../data-test';

type DownloadCSVButtonProps = {
  loaded: boolean;
  filteredData: AggregatedAlert[];
};

const DownloadCSVButton: FC<DownloadCSVButtonProps> = ({ loaded, filteredData }) => {
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const getTableData = () => {
    const csvColumns = ['Name', 'Severity', 'State', 'Total'];
    if (perspective === 'acm') {
      csvColumns.push('Cluster');
    }
    const getCsvRows = () => {
      return filteredData?.map((row) => {
        const name = row?.name ?? '';
        const severity = row?.severity ?? '';
        const state = Array.from(row?.states || [])?.join(', ');
        const total = row?.alerts?.length ?? 0;
        const rowData = [name, severity, state, total];
        if (perspective === 'acm') {
          const clusters = Array.from(
            new Set(row?.alerts?.map((alert) => alert.labels?.cluster) || []),
          );
          rowData.push(clusters?.join(', ') ?? '');
        }
        return rowData;
      });
    };
    return [csvColumns, ...getCsvRows()];
  };

  const formatToCsv = (tableData, delimiter = ',') =>
    tableData
      ?.map((row) =>
        row?.map((rowItem) => (isNaN(rowItem) ? `"${rowItem}"` : rowItem)).join(delimiter),
      )
      ?.join('\n');

  let csvData: string;
  if (loaded) {
    csvData = formatToCsv(getTableData()) ?? undefined;
  }

  const downloadCsv = () => {
    // csvData should be formatted as comma-seperated values
    // (e.g. `"a","b","c", \n"d","e","f", \n"h","i","j"`)
    const blobCsvData = new Blob([csvData], { type: 'text/csv' });
    const csvURL = URL.createObjectURL(blobCsvData);
    const link = document.createElement('a');
    link.href = csvURL;
    link.download = `openshift.csv`;
    link.click();
  };

  return (
    <Button
      className="co-virtualized-table--export-csv-button"
      onClick={downloadCsv}
      variant={ButtonVariant.link}
      data-test={AlertsPageTestIDs.DownloadCSVButton}
    >
      {t('Export as CSV')}
    </Button>
  );
};

export default DownloadCSVButton;
