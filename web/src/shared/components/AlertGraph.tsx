import type { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { FormatSeriesTitle, QueryBrowser } from '@/shared/components/query-browser/QueryBrowser';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import { getQueryBrowserUrl, usePerspective } from '@/shared/hooks/usePerspective';

export const AlertGraph: FC<AlertGraphProps> = ({
  filterLabels = undefined,
  formatSeriesTitle,
  query,
  ruleDuration,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

  // 3 times the rule's duration in seconds, but not less than 30 minutes
  const timespanMs = Math.max(3 * ruleDuration, 30 * 60) * 1000;

  const GraphLink = () =>
    query && perspective !== 'acm' ? (
      <Link aria-label={t('Inspect')} to={getQueryBrowserUrl({ perspective, query, namespace })}>
        {t('Inspect')}
      </Link>
    ) : null;

  return (
    <QueryBrowser
      defaultTimespan={timespanMs}
      filterLabels={filterLabels}
      formatSeriesTitle={formatSeriesTitle}
      GraphLink={GraphLink}
      pollInterval={Math.round(timespanMs / 120)}
      queries={[query]}
    />
  );
};

type AlertGraphProps = {
  filterLabels?: PrometheusLabels;
  formatSeriesTitle?: FormatSeriesTitle;
  query: string;
  ruleDuration: number;
  showLegend?: boolean;
};
