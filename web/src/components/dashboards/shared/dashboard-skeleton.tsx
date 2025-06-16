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
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { TimeRangeControls } from '@perses-dev/plugin-system';
import { DashboardStickyToolbar } from '@perses-dev/dashboards';

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Split hasGutter isWrappable>
      <SplitItem isFilled>
        <Title headingLevel="h1">{t('Dashboards')}</Title>
      </SplitItem>
      <SplitItem>
        <Split hasGutter isWrappable>
          <SplitItem>
            <b> {t('Time Range Controls')} </b>
            <TimeRangeControls />
          </SplitItem>
        </Split>
      </SplitItem>
    </Split>
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
      <PageSection variant={PageSectionVariants.light}>
        {perspective !== 'dev' && <HeaderTop />}
        <Stack hasGutter>
          {!_.isEmpty(boardItems) && (
            <StackItem>
              <DashboardDropdown
                items={boardItems}
                onChange={changeBoard}
                selectedKey={dashboardName}
              />
            </StackItem>
          )}
          {isPerses ? (
            <StackItem>
              <b> {t('Dashboard Variables')} </b>
              <DashboardStickyToolbar initialVariableIsSticky={false} />
            </StackItem>
          ) : (
            <StackItem>
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
