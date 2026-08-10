import { type Alert, AlertStates, type Rule } from '@openshift-console/dynamic-plugin-sdk';
import { FlexItem } from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/mcp-overview/components/summary/SummaryCard';
import { useAlerts } from '@/shared/hooks/useAlerts';
import { getAlertRulesUrl, getAlertsUrl, usePerspective } from '@/shared/hooks/usePerspective';
import type { Perspective } from '@/shared/store/actions';
import type { AlertSource } from '@/shared/types/types';
import { AlertFilterOptions, alertingRuleSource, filterAlerts } from '@/shared/utils/alert-utils';
import { ALL_NAMESPACES_KEY } from '@/shared/utils/utils';

type RulesAlertLoading = {
  loaded?: boolean;
  loadError?: unknown;
};

export const getAlertsError = (rulesAlertLoading?: RulesAlertLoading): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadError = (rulesAlertLoading?.loadError as any)?.message ?? rulesAlertLoading?.loadError;
  return loadError == null ? undefined : String(loadError);
};

export const getFiringAlerts = ({
  alerts,
  alertsError,
  loaded,
  defaultAlertTenant,
  perspective,
}: {
  alerts?: Alert[];
  alertsError?: string;
  loaded?: boolean;
  defaultAlertTenant: AlertSource[];
  perspective: Perspective;
}): Alert[] => {
  if (alertsError || !loaded) {
    return [];
  }

  const filters = {
    [AlertFilterOptions.NAME]: '',
    [AlertFilterOptions.STATE]: [AlertStates.Firing],
    [AlertFilterOptions.SEVERITY]: [],
    [AlertFilterOptions.SOURCE]: defaultAlertTenant,
    [AlertFilterOptions.LABEL]: '',
  };

  return filterAlerts(alerts, filters, ALL_NAMESPACES_KEY, perspective);
};

export const getAlertSummaryState = ({
  alerts,
  rules,
  rulesAlertLoading,
  defaultAlertTenant,
  perspective,
}: {
  alerts?: Alert[];
  rules?: Rule[];
  rulesAlertLoading?: RulesAlertLoading;
  defaultAlertTenant: AlertSource[];
  perspective: Perspective;
}) => {
  const alertsError = getAlertsError(rulesAlertLoading);
  const loaded = rulesAlertLoading?.loaded;
  const firingAlerts = getFiringAlerts({
    alerts,
    alertsError,
    loaded,
    defaultAlertTenant,
    perspective,
  });

  const rulesCount =
    rules?.filter(
      (rule) =>
        defaultAlertTenant.length === 0 ||
        defaultAlertTenant.includes(alertingRuleSource(rule) as AlertSource),
    ).length ?? 0;

  return {
    loading: !loaded,
    error: alertsError,
    rulesCount,
    firingAlertsCount: firingAlerts.length,
  };
};

const AlertSummaryCards: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { defaultAlertTenant, perspective } = usePerspective();

  const { alerts, rules, rulesAlertLoading } = useAlerts({ dontUseTenancy: true });

  const { loading, error, rulesCount, firingAlertsCount } = getAlertSummaryState({
    alerts,
    rules,
    rulesAlertLoading,
    defaultAlertTenant,
    perspective,
  });

  return (
    <>
      <FlexItem>
        <SummaryCard
          cardId="alerting-rules"
          count={rulesCount}
          title={t('Alerting rules')}
          url={getAlertRulesUrl(perspective)}
          loading={loading}
          error={error}
        />
      </FlexItem>
      <FlexItem>
        <SummaryCard
          cardId="firing-alerts"
          count={firingAlertsCount}
          title={t('Firing alerts')}
          url={getAlertsUrl(perspective)}
          loading={loading}
          error={error}
        />
      </FlexItem>
    </>
  );
};

export default AlertSummaryCards;
