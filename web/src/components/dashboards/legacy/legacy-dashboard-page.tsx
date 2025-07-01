import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { usePerspective } from 'src/components/hooks/usePerspective';
import { LoadingInline } from '../../../components/console/console-shared/src/components/loading/LoadingInline';
import withFallback from '../../console/console-shared/error/fallbacks/withFallback';
import { LegacyDashboard } from '../legacy/legacy-dashboard';
import { DashboardSkeletonLegacy } from './dashboard-skeleton-legacy';
import ErrorAlert from './error';
import { useLegacyDashboards } from './useLegacyDashboards';

type MonitoringLegacyDashboardsPageProps = {
  urlBoard: string;
  namespace?: string;
};

const LegacyDashboardsPage_: React.FC<MonitoringLegacyDashboardsPageProps> = ({
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

type MonitoringLegacyDashboardsWrapperProps = RouteComponentProps<{
  dashboardName: string;
  ns?: string;
}>;

const MonitoringLegacyDashboardsPageWrapper: React.FC<MonitoringLegacyDashboardsWrapperProps> = ({
  match,
}) => {
  return (
    <LegacyDashboardsPage_ urlBoard={match.params.dashboardName} namespace={match.params?.ns} />
  );
};

const MonitoringLegacyDashboardsPage = withRouter(MonitoringLegacyDashboardsPageWrapper);

export default withFallback(MonitoringLegacyDashboardsPage);
