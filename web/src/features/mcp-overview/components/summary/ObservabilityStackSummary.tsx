import { Content, ContentVariants, Flex, FlexItem } from '@patternfly/react-core';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import AlertSummaryCards from '@/features/mcp-overview/components/summary/AlertSummaryCards';
import DashboardsSummaryCard from '@/features/mcp-overview/components/summary/DashboardsSummaryCard';
import MetricsSummaryCard from '@/features/mcp-overview/components/summary/MetricsSummaryCard';
import TargetsSummaryCard from '@/features/mcp-overview/components/summary/TargetsSummaryCard';
import { DataTestIDs } from '@/shared/constants/data-test';

const ObservabilityStackSummary: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Flex
      direction={{ default: 'column' }}
      spaceItems={{ default: 'spaceItemsMd' }}
      data-test={DataTestIDs.McpOverviewPage.SummarySection}
    >
      <FlexItem>
        <Content component={ContentVariants.h2}>{t('Observability stack summary')}</Content>
        <Content component={ContentVariants.p}>
          {t(
            'Inventory of configured observability surfaces. Select a number to open the related Observe view.',
          )}
        </Content>
      </FlexItem>
      <FlexItem>
        <Flex flexWrap={{ default: 'wrap' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <DashboardsSummaryCard />
          </FlexItem>
          <AlertSummaryCards />
          <FlexItem>
            <TargetsSummaryCard />
          </FlexItem>
          <FlexItem>
            <MetricsSummaryCard />
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );
};

export default ObservabilityStackSummary;
