import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Divider, PageSection, Split, SplitItem, Stack, StackItem } from '@patternfly/react-core';
import * as _ from 'lodash-es';
import type { FC, PropsWithChildren } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { DashboardDropdown } from '@/features/legacy-dashboards/components/LegacyDashboardDropdown';
import { LegacyDashboardsAllVariableDropdowns } from '@/features/legacy-dashboards/components/LegacyVariableDropdowns';
import {
  PollIntervalDropdown,
  TimespanDropdown,
} from '@/features/legacy-dashboards/components/TimeDropdowns';
import { LegacyDashboardMetadata } from '@/features/legacy-dashboards/types/types';

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

HeaderTop.displayName = 'HeaderTop';

type MonitoringDashboardsLegacyPageProps = PropsWithChildren<{
  boardItems: LegacyDashboardMetadata[];
  changeBoard: (params: { newBoard?: string; initialLoad?: boolean; newProject?: string }) => void;
  dashboardName: string;
}>;

export const DashboardSkeletonLegacy = memo(
  ({ children, boardItems, changeBoard, dashboardName }: MonitoringDashboardsLegacyPageProps) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const onChangeBoard = useCallback(
      (selectedDashboard: string) => {
        changeBoard({ newBoard: selectedDashboard });
      },
      [changeBoard],
    );

    return (
      <>
        <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
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
              <LegacyDashboardsAllVariableDropdowns
                key={dashboardName}
                dashboardName={dashboardName}
              />
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

DashboardSkeletonLegacy.displayName = 'DashboardSkeletonLegacy';
