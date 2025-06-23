import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

import { usePerspective } from '../../hooks/usePerspective';
import { DashboardDropdown } from './dashboard-dropdown';
import { LegacyDashboardsAllVariableDropdowns } from '../legacy/legacy-variable-dropdowns';
import { TimeDropdowns } from './time-dropdowns';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { useIsPerses } from './useIsPerses';
import {
  Divider,
  PageSection,
  PageSectionVariants,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import {
  DashboardStickyToolbar,
  useExternalVariableDefinitions,
  useVariableDefinitions,
} from '@perses-dev/dashboards';

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

  // Check Dashboard Variables are present
  const [hasVariables, setHasVariables] = React.useState(false);
  const variableDefinitions = useVariableDefinitions();
  const externalVariableDefinitions = useExternalVariableDefinitions();
  React.useEffect(() => {
    const areVariablesPresent =
      variableDefinitions?.length > 0 || externalVariableDefinitions?.length > 0;
    setHasVariables(areVariablesPresent);
  }, [variableDefinitions, externalVariableDefinitions]);

  return (
    <>
      {perspective !== 'dev' && (
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
      )}
      <PageSection variant={PageSectionVariants.light}>
        {perspective !== 'dev' && <HeaderTop />}
        <Stack hasGutter>
          {!_.isEmpty(boardItems) && (
            <StackItem araia-label="Dashboard Dropdown">
              <DashboardDropdown
                items={boardItems}
                onChange={changeBoard}
                selectedKey={dashboardName}
              />
            </StackItem>
          )}
          {isPerses && hasVariables ? (
            <StackItem aria-label="Perses Dashboard Variables">
              <b> {t('Dashboard Variables')} </b>
              <DashboardStickyToolbar initialVariableIsSticky={false} />
            </StackItem>
          ) : (
            <StackItem aria-label="Legacy Dashboard Variables">
              <LegacyDashboardsAllVariableDropdowns key={dashboardName} />
            </StackItem>
          )}
          {perspective === 'dev' && <TimeDropdowns />}
        </Stack>
      </PageSection>
      <Divider />
      {children}
    </>
  );
};

export default DashboardSkeleton;
