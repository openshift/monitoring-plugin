import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, AlertActionCloseButton, PageBody, PageSection } from '@patternfly/react-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ObservabilityStackSummary from '@/features/mcp-overview/components/summary/ObservabilityStackSummary';
import { DataTestIDs } from '@/shared/constants/data-test';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';

const MCP_OVERVIEW_INFO_ALERT_DISMISSED = 'monitoring/mcp-overview/info-alert-dismissed';

const McpOverviewPage: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [showInfoAlert, setShowInfoAlert] = useState(
    () => localStorage.getItem(MCP_OVERVIEW_INFO_ALERT_DISMISSED) !== 'true',
  );

  const dismissInfoAlert = () => {
    localStorage.setItem(MCP_OVERVIEW_INFO_ALERT_DISMISSED, 'true');
    setShowInfoAlert(false);
  };

  return (
    <>
      <DocumentTitle>{t('Observability services')}</DocumentTitle>
      <ListPageHeader
        title={t('Observability services')}
        helpText={t(
          'Manage and monitor your metrics, logs, and traces from a single, unified hub.',
        )}
        hideFavoriteButton
      />
      <PageBody>
        {showInfoAlert ? (
          <PageSection>
            <Alert
              isInline
              variant="info"
              title={t('Cluster-wide observability scope')}
              data-test={DataTestIDs.McpOverviewPage.InfoAlert}
              actionClose={
                <AlertActionCloseButton
                  aria-label={t('Close observability capabilities information message')}
                  data-test={`${DataTestIDs.McpOverviewPage.InfoAlertClose}`}
                  onClose={dismissInfoAlert}
                />
              }
            >
              {t(
                'This hub reflects observability capabilities for the current cluster after Cluster Observability Operator installation. Status labels indicate enablement and configuration readiness—not live telemetry severity.',
              )}
            </Alert>
          </PageSection>
        ) : null}
        <PageSection hasShadowTop>
          <ObservabilityStackSummary />
        </PageSection>
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

export const MpCmoMcpOverviewPage: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
        <McpOverviewPage />
      </MonitoringProvider>
    </QueryClientProvider>
  );
};
