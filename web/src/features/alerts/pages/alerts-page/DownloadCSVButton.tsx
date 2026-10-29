import { Button, ButtonVariant } from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTestIDs } from '@/shared/constants/data-test';
import { usePerspective } from '@/shared/hooks/usePerspective';
import { AggregatedAlert } from '@/shared/types/types';
import { downloadCsv, formatCsv } from '@/shared/utils/csv';

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
        const state = row?.state ?? '';
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

  let csvData: string;
  if (loaded) {
    csvData = formatCsv(getTableData()) ?? undefined;
  }

  const handleDownloadCsv = () => {
    downloadCsv(new Blob([csvData], { type: 'text/csv' }), 'openshift.csv');
  };

  return (
    <Button
      onClick={handleDownloadCsv}
      variant={ButtonVariant.link}
      data-test={DataTestIDs.DownloadCSVButton}
    >
      {t('Export as CSV')}
    </Button>
  );
};

export default DownloadCSVButton;
