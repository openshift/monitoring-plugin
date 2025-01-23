import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getObserveState, usePerspective } from '../../hooks/usePerspective';
import { DashboardDropdown } from './dashboard-dropdown';
import { MonitoringState } from '../../../reducers/observe';
import { LegacyDashboardsAllVariableDropdowns } from '../legacy/legacy-variable-dropdowns';
import { TimeDropdowns } from './time-dropdowns';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { AllVariableDropdowns } from '../perses/variable-dropdowns';

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div className="monitoring-dashboards__header">
      <h1 className="co-m-pane__heading">
        <span>{t('Dashboards')}</span>
      </h1>
      <TimeDropdowns />
    </div>
  );
});

type MonitoringDashboardsPageProps = React.PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  isPerses: boolean; // leave default as truthy so removal doesn't change component default behavior
}>;

const DashboardSkeleton: React.FC<MonitoringDashboardsPageProps> = ({
  children,
  boardItems,
  changeBoard,
  isPerses,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const dashboardName = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'name']),
  );

  return (
    <>
      {perspective !== 'dev' && (
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
      )}
      <div className="co-m-nav-title co-m-nav-title--detail">
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
      </div>
      {children}
    </>
  );
};

export default DashboardSkeleton;
