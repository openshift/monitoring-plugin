import {
  Bullseye,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Spinner,
} from '@patternfly/react-core';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import { CapabilitiesSummaryCard } from '@/features/overview/components/summary/CapabilitiesSummaryCard';
import { ComponentHealthSummaryCard } from '@/features/overview/components/summary/ComponentHealthSummaryCard';
import { ObservabilityCapability } from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

type StackSummaryProps = {
  observabilityCapabilities: ObservabilityCapability[];
  loaded: boolean;
};

export const StackSummary: FC<StackSummaryProps> = ({ observabilityCapabilities, loaded }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Flex
      direction={{ default: 'column' }}
      spaceItems={{ default: 'spaceItemsMd' }}
      data-test={DataTestIDs.OverviewPage.SummarySection}
    >
      <FlexItem>
        <Content component={ContentVariants.h2}>{t('Stack summary')}</Content>
      </FlexItem>
      <FlexItem>
        {!loaded ? (
          <Bullseye>
            <Spinner aria-label={t('Loading stack summary data')} />
          </Bullseye>
        ) : (
          <Grid hasGutter>
            <GridItem sm={6}>
              <CapabilitiesSummaryCard observabilityCapabilities={observabilityCapabilities} />
            </GridItem>
            <GridItem sm={6}>
              <ComponentHealthSummaryCard observabilityCapabilities={observabilityCapabilities} />
            </GridItem>
          </Grid>
        )}
      </FlexItem>
    </Flex>
  );
};
