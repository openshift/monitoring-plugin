import { Button, Tooltip } from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import {
  OptionalAlertColumn,
  optionalAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { formatFiringSince } from '@/features/alert-management-api/utils/alert-values';
import { getSourceKey } from '@/shared/utils/alerts/alert-source';
import { downloadCsv, formatCsv } from '@/shared/utils/csv';
import { startCase } from '@/shared/utils/strings';

const getOptionalValue: Record<OptionalAlertColumn, (alert: AggregatedAlert) => string | number> = {
  total: (alert) => alert.alerts.length,
  state: (alert) => alert.state.join(', '),
  scope: (alert) => alert.alertScope,
  component: (alert) => alert.component,
  source: (alert) => alert.source,
  description: (alert) =>
    alert.alerts[0]?.annotations.description ?? alert.alerts[0]?.annotations.summary ?? '',
  firingSince: (alert) => formatFiringSince(alert.alerts),
  runbookUrl: (alert) => alert.alerts[0]?.annotations.runbook_url ?? '',
  namespace: (alert) => alert.alerts[0]?.labels.namespace ?? '',
  resource: (alert) => alert.alerts[0]?.labels.resource ?? '',
};

export function ExportAlertsButton({ alerts }: { alerts: AggregatedAlert[] }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const exportAlerts = () => {
    const columns = [
      { label: t('Alert name'), value: (alert: AggregatedAlert) => alert.name },
      { label: t('Severity'), value: (alert: AggregatedAlert) => alert.severity },
      ...optionalAlertColumns.map(({ key, label }) => ({
        label: t(label),
        value:
          key === 'source'
            ? (alert: AggregatedAlert) => getSourceKey(startCase(alert.source), t)
            : getOptionalValue[key],
      })),
    ];
    const rows = [
      columns.map(({ label }) => label),
      ...alerts.map((alert) => columns.map(({ value }) => value(alert))),
    ];
    downloadCsv(new Blob([formatCsv(rows)], { type: 'text/csv' }), 'alerts.csv');
  };

  return (
    <Tooltip content={t('Export as CSV')}>
      <Button
        variant="control"
        icon={<DownloadIcon />}
        aria-label={t('Export as CSV')}
        onClick={exportAlerts}
      />
    </Tooltip>
  );
}
