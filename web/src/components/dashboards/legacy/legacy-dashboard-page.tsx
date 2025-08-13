import { Overview } from '@openshift-console/dynamic-plugin-sdk';
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

type LegacyDashboardsPageProps = {
  urlBoard: string;
  namespace?: string;
};

const LegacyDashboardsPage_: FC<LegacyDashboardsPageProps> = ({
  urlBoard,
  namespace, // only used in developer perspective
}) => {
  const {
    legacyDashboardsError,
    legacyRows,
    legacyDashboardsLoading,
    legacyDashboardsMetadata,
    changeLegacyDashboard,
    legacyDashboard,
  } = useLegacyDashboards(namespace, urlBoard);
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
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
  );
};

const LegacyDashboardsPage: FC = () => {
  const params = useParams<{ ns?: string; dashboardName: string }>();

  return (
    <QueryParamProvider adapter={ReactRouter5Adapter}>
      <LegacyDashboardsPage_ urlBoard={params?.dashboardName} namespace={params?.ns} />
    </QueryParamProvider>
  );
};

export default withFallback(LegacyDashboardsPage);
