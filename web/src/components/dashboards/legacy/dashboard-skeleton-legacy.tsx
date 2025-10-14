import * as _ from 'lodash-es';
import type { FC, PropsWithChildren } from 'react';
import { memo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

import { Divider, PageSection, Split, SplitItem, Stack, StackItem } from '@patternfly/react-core';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import { PollIntervalDropdown, TimespanDropdown } from './time-dropdowns';
import { LegacyDashboardsAllVariableDropdowns } from './legacy-variable-dropdowns';
import { ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';

const HeaderTop: FC = memo(() => {
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

type MonitoringDashboardsLegacyPageProps = PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardName: string;
}>;

export const DashboardSkeletonLegacy: FC<MonitoringDashboardsLegacyPageProps> = memo(
  ({ children, boardItems, changeBoard, dashboardName }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const onChangeBoard = useCallback(
      (selectedDashboard: string) => {
        changeBoard(selectedDashboard);
      },
      [changeBoard],
    );

    return (
      <>
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
        <HeaderTop />
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
            <StackItem>
              <Split>
                <SplitItem isFilled />
              </Split>
            </StackItem>
          </Stack>
        </PageSection>
        <Divider />
        {children}
      </>
    );
  },
);
