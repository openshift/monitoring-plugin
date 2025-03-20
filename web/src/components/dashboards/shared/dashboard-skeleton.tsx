import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

import { usePerspective } from '../../hooks/usePerspective';
import { DashboardDropdown } from './dashboard-dropdown';
import { LegacyDashboardsAllVariableDropdowns } from '../legacy/legacy-variable-dropdowns';
import { TimeDropdowns } from './time-dropdowns';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { AllVariableDropdowns } from '../perses/variable-dropdowns';
import { useIsPerses } from './useIsPerses';
import { Divider, PageSection, Title } from '@patternfly/react-core';

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div className="monitoring-dashboards__header">
      <Title headingLevel="h1">{t('Dashboards')}</Title>
      <TimeDropdowns />
    </div>
  );
});

type MonitoringDashboardsPageProps = React.PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardName: string;
}>;

const DashboardSkeleton: React.FC<MonitoringDashboardsPageProps> = ({
  children,
  boardItems,
  changeBoard,
  dashboardName,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const isPerses = useIsPerses();

  const { perspective } = usePerspective();

  return (
    <>
      {perspective !== 'dev' && (
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
      )}
      <PageSection hasBodyWrapper={false} >
        {perspective !== 'dev' && <HeaderTop />}
        <div className="monitoring-dashboards__variables">
          <div className="monitoring-dashboards__dropdowns">
            {!_.isEmpty(boardItems) && (
              <DashboardDropdown
                items={boardItems}
                onChange={changeBoard}
                selectedKey={dashboardName}
              />
            )}
            {isPerses ? (
              <AllVariableDropdowns key={dashboardName} />
            ) : (
              <LegacyDashboardsAllVariableDropdowns key={dashboardName} />
            )}
          </div>
          {perspective === 'dev' && <TimeDropdowns />}
        </div>
      </PageSection>
      <Divider />
      {children}
    </>
  );
};

export default DashboardSkeleton;
