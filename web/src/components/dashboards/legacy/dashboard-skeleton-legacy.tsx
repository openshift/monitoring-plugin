import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Divider, PageSection, Split, SplitItem, Stack, StackItem } from '@patternfly/react-core';
import { usePerspective } from '../../hooks/usePerspective';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import { PollIntervalDropdown, TimespanDropdown } from './time-dropdowns';
import { LegacyDashboardsAllVariableDropdowns } from './legacy-variable-dropdowns';

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ListPageHeader title={t('Dashboards')}>
      <Split hasGutter isWrappable>
        <SplitItem>
          <TimespanDropdown />
        </SplitItem>
        <SplitItem>
          <PollIntervalDropdown />
        </SplitItem>
      </Split>
    </ListPageHeader>
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
        {perspective !== 'dev' && <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>}
        {perspective !== 'dev' && <HeaderTop />}
        <PageSection hasBodyWrapper={false}>
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
