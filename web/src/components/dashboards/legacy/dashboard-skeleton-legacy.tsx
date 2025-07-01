import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

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
import { usePerspective } from '../../../components/hooks/usePerspective';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import { LegacyDashboardsAllVariableDropdowns } from './legacy-variable-dropdowns';
import { PollIntervalDropdown, TimespanDropdown } from './time-dropdowns';

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
            <TimespanDropdown />
          </SplitItem>
          <SplitItem>
            <PollIntervalDropdown />
          </SplitItem>
        </Split>
      </SplitItem>
    </Split>
  );
});

type MonitoringDashboardsLegacyPageProps = React.PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardName: string;
}>;

export const DashboardSkeletonLegacy: React.FC<MonitoringDashboardsLegacyPageProps> = React.memo(
  ({ children, boardItems, changeBoard, dashboardName }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const { perspective } = usePerspective();

    const onChangeBoard = React.useCallback(
      (selectedDashboard: string) => {
        changeBoard(selectedDashboard);
      },
      [changeBoard],
    );

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

            <StackItem>
              <LegacyDashboardsAllVariableDropdowns key={dashboardName} />
            </StackItem>
            {perspective === 'dev' ? (
              <StackItem>
                <Split hasGutter>
                  <SplitItem isFilled />
                  <SplitItem>
                    <TimespanDropdown />
                  </SplitItem>
                  <SplitItem>
                    <PollIntervalDropdown />
                  </SplitItem>
                </Split>
              </StackItem>
            ) : (
              <StackItem>
                <Split>
                  <SplitItem isFilled />
                </Split>
              </StackItem>
            )}
          </Stack>
        </PageSection>
        <Divider />
        {children}
      </>
    );
  },
);
