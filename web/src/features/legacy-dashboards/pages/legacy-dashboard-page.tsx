import { NamespaceBar, Overview } from '@openshift-console/dynamic-plugin-sdk';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { StringParam, useQueryParam } from 'use-query-params';

import { DashboardSkeletonLegacy } from '@/features/legacy-dashboards/components/dashboard-skeleton-legacy';
import ErrorAlert from '@/features/legacy-dashboards/components/error';
import { LegacyDashboard } from '@/features/legacy-dashboards/components/legacy-dashboard';
import { useLegacyDashboards } from '@/features/legacy-dashboards/hooks/useLegacyDashboards';
import withFallback from '@/shared/console/console-shared/error/fallbacks/withFallback';
import { LoadingInline } from '@/shared/console/console-shared/src/components/loading/LoadingInline';
import { QueryParams } from '@/shared/constants/query-params';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { usePerspective } from '@/shared/hooks/usePerspective';

type LegacyDashboardsPageProps = {
  urlBoard: string;
};

const LegacyDashboardsPage_: FC<LegacyDashboardsPageProps> = ({ urlBoard }) => {
  const {
    legacyDashboardsError,
    legacyRows,
    legacyDashboardsLoading,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard,
  } = useLegacyDashboards(urlBoard);
  const { perspective } = usePerspective();
  const { displayNamespaceSelector } = useMonitoring();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      {displayNamespaceSelector && (
        <NamespaceBar
          onNamespaceChange={(ns) => {
            changeLegacyDashboard({ newProject: ns });
          }}
        />
      )}
      <DashboardSkeletonLegacy
        boardItems={legacyDashboardsMetadata}
        changeBoard={changeLegacyDashboard}
        dashboardName={legacyDashboard}
      >
        <Overview>
          {legacyDashboardsLoading ? (
            <LoadingInline />
          ) : legacyDashboardsError ? (
            <ErrorAlert
              error={{ message: legacyDashboardsError, name: t('Error Loading Dashboards') }}
            />
          ) : (
            <LegacyDashboard
              rows={legacyRows}
              perspective={perspective}
              dashboardName={legacyDashboard}
            />
          )}
        </Overview>
      </DashboardSkeletonLegacy>
    </>
  );
};

const LegacyDashboardsPageWithFallback = withFallback(LegacyDashboardsPage_);

export const MpCmoLegacyDashboardsPage: FC = () => {
  const params = useParams<{ dashboardName: string }>();

  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <LegacyDashboardsPageWithFallback urlBoard={params?.dashboardName} />
    </MonitoringProvider>
  );
};

// Small wrapper to be able to use the query params provided by the monitoring provider
const DashboardQueryWrapper = () => {
  const [dashboard] = useQueryParam(QueryParams.Dashboard, StringParam);

  return <LegacyDashboardsPageWithFallback urlBoard={dashboard} />;
};

export const MpCmoLegacyDevDashboardsPage: FC = () => {
  return (
    <MonitoringProvider
      monitoringContext={{
        plugin: 'monitoring-plugin',
        prometheus: 'cmo',
        displayNamespaceSelector: false,
      }}
    >
      <DashboardQueryWrapper />
    </MonitoringProvider>
  );
};
