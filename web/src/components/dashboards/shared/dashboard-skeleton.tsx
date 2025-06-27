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
import {
  DashboardStickyToolbar,
  useDashboardActions,
  useVariableDefinitions,
} from '@perses-dev/dashboards';

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

const DashboardSkeleton: React.FC<MonitoringDashboardsPageProps> = React.memo(
  ({ children, boardItems, changeBoard, dashboardName }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);
    const isPerses = useIsPerses();

    const { perspective } = usePerspective();
    const { setDashboard } = useDashboardActions();
    const variables = useVariableDefinitions();

    const onChangeBoard = (selectedDashboard: string) => {
      changeBoard(selectedDashboard);

      if (isPerses) {
        const selectedBoard = boardItems.find(
          (item) => item.name.toLowerCase() === selectedDashboard.toLowerCase(),
        );

        if (selectedBoard) {
          setDashboard(selectedBoard.persesDashboard);
        }
      }
    };

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
                  onChange={onChangeBoard}
                  selectedKey={dashboardName}
                />
              </StackItem>
            )}
            {isPerses ? (
              variables.length > 0 ? (
                <StackItem>
                  <b> {t('Dashboard Variables')} </b>
                  <DashboardStickyToolbar initialVariableIsSticky={false} key={dashboardName} />
                </StackItem>
              ) : null
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
  },
);

export default DashboardSkeleton;
