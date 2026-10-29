import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LogsMetrics } from '@/features/logging/components/LogsMetrics';
import { TimeRangeDropdown } from '@/features/logging/components/TimeRangeDropdown';
import { LogsConfigProvider, useLogsConfig } from '@/features/logging/hooks/LogsConfigProvider';
import { useLogs } from '@/features/logging/hooks/useLogs';
import { Rule, TimeRange } from '@/features/logging/utils/logs-types';
import { getSchema } from '@/features/logging/utils/value-utils';

interface LogsAlertMetricsProps {
  rule?: Rule;
}

const LOKI_TENANT_LABEL_KEY = 'tenantId';

const LogsAlertMetrics: FC<LogsAlertMetricsProps> = ({ rule }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { getLogs, logsData, logsError, isLoadingLogsData } = useLogs();
  const { config, configLoaded } = useLogsConfig();

  const tenant = rule?.labels?.[config.alertingRuleTenantLabelKey ?? LOKI_TENANT_LABEL_KEY];
  const [timeRange, setTimeRange] = useState<TimeRange | undefined>();

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    if (rule?.query && tenant) {
      getLogs({ query: rule.query, timeRange, tenant, schema: getSchema(config.schema) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule?.query, timeRange, configLoaded, tenant, config.schema]);

  const tenantError = !tenant
    ? new Error(
        t('Label {{tenantKey}} is required to display the alert metrics', {
          tenantKey: LOKI_TENANT_LABEL_KEY,
        }),
      )
    : undefined;

  return (
    <div className="lv-plugin__alert-metrics__container">
      <div className="lv-plugin__metrics__header">
        <TimeRangeDropdown value={timeRange} onChange={setTimeRange} />
      </div>
      <LogsMetrics
        logsData={logsData}
        error={logsError || tenantError}
        isLoading={isLoadingLogsData}
        timeRange={timeRange}
      />
    </div>
  );
};

const LogsAlertMetricsWrapper: FC<LogsAlertMetricsProps> = (props) => {
  return (
    <LogsConfigProvider>
      <LogsAlertMetrics {...props} />
    </LogsConfigProvider>
  );
};

export default LogsAlertMetricsWrapper;
