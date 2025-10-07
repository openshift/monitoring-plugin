import { NamespaceBar, Overview } from '@openshift-console/dynamic-plugin-sdk';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom-v5-compat';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { LoadingInline } from '../../../components/console/console-shared/src/components/loading/LoadingInline';
import withFallback from '../../console/console-shared/error/fallbacks/withFallback';
import { usePerspective } from '../../hooks/usePerspective';
import { LegacyDashboard } from '../legacy/legacy-dashboard';
import ErrorAlert from './error';
import { DashboardSkeletonLegacy } from './dashboard-skeleton-legacy';
import { useLegacyDashboards } from './useLegacyDashboards';
import { MonitoringProvider } from '../../../contexts/MonitoringContext';
import { useOpenshiftProject } from './useOpenshiftProject';

type LegacyDashboardsPageProps = {
  urlBoard: string;
};

const LegacyDashboardsPage_: FC<LegacyDashboardsPageProps> = ({ urlBoard }) => {
  const { project, setProject } = useOpenshiftProject();
  const {
    legacyDashboardsError,
    legacyRows,
    legacyDashboardsLoading,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard,
  } = useLegacyDashboards(project, urlBoard);
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <>
      <NamespaceBar onNamespaceChange={(namespace) => setProject(namespace)} />
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
            <LegacyDashboard rows={legacyRows} perspective={perspective} />
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
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <LegacyDashboardsPageWithFallback urlBoard={params?.dashboardName} />
      </QueryParamProvider>
    </MonitoringProvider>
  );
};
