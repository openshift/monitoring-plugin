import { Overview } from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../../console/console-shared/error/error-boundary';
import ErrorAlert from '../../console/console-shared/alerts/error';
import { LoadingInline } from '../../console/utils/status-box';

import { LegacyDashboard } from '../legacy/legacy-dashboard';
import DashboardSkeleton from '../shared/dashboard-skeleton';
import { usePerspective } from '../../hooks/usePerspective';
import { useTranslation } from 'react-i18next';
import { useLegacyDashboards } from './useLegacyDashboards';
import { PersesContext } from '../../router';

type MonitoringLegacyDashboardsPageProps = {
  urlBoard: string;
  namespace?: string;
};

const MonitoringLegacyDashboardsPage_: React.FC<MonitoringLegacyDashboardsPageProps> = ({
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
    <>
      <DashboardSkeleton
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
      </DashboardSkeleton>
    </>
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
    <PersesContext.Provider value={false}>
      <MonitoringLegacyDashboardsPage_
        urlBoard={match.params.dashboardName}
        namespace={match.params?.ns}
      />
    </PersesContext.Provider>
  );
};

const MonitoringLegacyDashboardsPage = withRouter(MonitoringLegacyDashboardsPageWrapper);

export default withFallback(MonitoringLegacyDashboardsPage);
