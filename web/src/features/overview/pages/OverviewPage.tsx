import {
  DocumentTitle,
  K8sResourceKind,
  ListPageHeader,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { Alert, AlertActionCloseButton, PageBody, PageSection } from '@patternfly/react-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OverviewPageContent } from '@/features/overview/components/pages/OverviewPageContent';
import { ClusterServiceVersionGroupVersionKind } from '@/features/overview/constants/const';
import { DataTestIDs } from '@/shared/constants/data-test';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';

const OVERVIEW_INFO_ALERT_DISMISSED = 'monitoring/overview/info-alert-dismissed';

const OverviewPage: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [showInfoAlert, setShowInfoAlert] = useState(
    () => localStorage.getItem(OVERVIEW_INFO_ALERT_DISMISSED) !== 'true',
  );

  const dismissInfoAlert = () => {
    localStorage.setItem(OVERVIEW_INFO_ALERT_DISMISSED, 'true');
    setShowInfoAlert(false);
  };

  const csvResults = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    groupVersionKind: ClusterServiceVersionGroupVersionKind,
    optional: true,
  });

  return (
    <>
      <DocumentTitle>{t('Observability services')}</DocumentTitle>
      <ListPageHeader
        title={t('Observability services')}
        helpText={t(
          'Manage observability capabilities and access cluster tools for metrics, logs, and traces.',
        )}
        hideFavoriteButton
      />
      <PageBody>
        {showInfoAlert ? (
          <PageSection>
            <Alert
              isInline
              variant="info"
              title={t('Cluster-wide scope')}
              data-test={DataTestIDs.OverviewPage.InfoAlert}
              actionClose={
                <AlertActionCloseButton
                  aria-label={t('Close observability capabilities information message')}
                  data-test={`${DataTestIDs.OverviewPage.InfoAlertClose}`}
                  onClose={dismissInfoAlert}
                />
              }
            >
              {t(
                'Status labels show configuration readiness across the cluster, not live telemetry severity.',
              )}
            </Alert>
          </PageSection>
        ) : null}
        <OverviewPageContent csvResults={csvResults} />
      </PageBody>
    </>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const MpCmoOverviewPage: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
        <OverviewPage />
      </MonitoringProvider>
    </QueryClientProvider>
  );
};
