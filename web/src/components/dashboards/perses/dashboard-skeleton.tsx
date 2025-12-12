import * as _ from 'lodash-es';
import type { FC, PropsWithChildren } from 'react';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Divider, PageSection, Split, SplitItem, Stack, StackItem } from '@patternfly/react-core';
import {
  DashboardStickyToolbar,
  useDashboardActions,
  useVariableDefinitions,
} from '@perses-dev/dashboards';
import { TimeRangeControls } from '@perses-dev/plugin-system';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import { CombinedDashboardMetadata } from './hooks/useDashboardsData';
import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';

const HeaderTop: FC = memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ListPageHeader title={t('Dashboards')}>
      <Split hasGutter isWrappable>
        <SplitItem>
          <TimeRangeControls />
        </SplitItem>
      </Split>
    </ListPageHeader>
  );
});

type MonitoringDashboardsPageProps = PropsWithChildren<{
  boardItems: CombinedDashboardMetadata[];
  changeBoard: (dashboardName: string) => void;
  dashboardName: string;
  activeProject?: string;
}>;

export const DashboardSkeleton: FC<MonitoringDashboardsPageProps> = memo(
  ({ children, boardItems, changeBoard, dashboardName, activeProject }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);
    const { setDashboard } = useDashboardActions();
    const variables = useVariableDefinitions();

    const onChangeBoard = useCallback(
      (selectedDashboard: string) => {
        changeBoard(selectedDashboard);

        const selectedBoard = boardItems.find(
          (item) =>
            item.name.toLowerCase() === selectedDashboard.toLowerCase() &&
            item.project?.toLowerCase() === activeProject?.toLowerCase(),
        );

        if (selectedBoard) {
          setDashboard(selectedBoard.persesDashboard);
        }
      },
      [changeBoard, boardItems, activeProject, setDashboard],
    );

    useEffect(() => {
      onChangeBoard(dashboardName);
    }, [dashboardName, onChangeBoard]);

    return (
      <>
        <DocumentTitle>{t('Metrics dashboards')}</DocumentTitle>
        <PageSection hasBodyWrapper={false}>
          <HeaderTop />
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
            {variables.length > 0 ? (
              <StackItem>
                <b> {t('Dashboard Variables')} </b>
                <DashboardStickyToolbar initialVariableIsSticky={false} key={dashboardName} />
              </StackItem>
            ) : null}
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
