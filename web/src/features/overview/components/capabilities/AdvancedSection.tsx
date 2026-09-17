import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { Content, ContentVariants, Flex, FlexItem, Spinner } from '@patternfly/react-core';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import CapabilitiesCatalog from '@/features/overview/components/capabilities/CapabilitiesCatalog';
import { ObservabilityCapability } from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

type AdvancedSectionProps = {
  capabilities: ObservabilityCapability[];
  monitoringPlugin: K8sResourceKind;
  loaded: boolean;
};

const AdvancedSection: FC<AdvancedSectionProps> = ({ capabilities, monitoringPlugin, loaded }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Flex
      direction={{ default: 'column' }}
      spaceItems={{ default: 'spaceItemsMd' }}
      data-test={DataTestIDs.OverviewPage.AdvancedSection}
    >
      <FlexItem>
        <Content component={ContentVariants.h2}>{t('Advanced analytics')}</Content>
      </FlexItem>
      <FlexItem>
        {!loaded ? (
          <div data-test={DataTestIDs.OverviewPage.RecommendedLoading}>
            <Spinner size="lg" aria-label={t('Loading recommended operators and add-ons')} />
          </div>
        ) : (
          <CapabilitiesCatalog capabilities={capabilities} monitoringPlugin={monitoringPlugin} />
        )}
      </FlexItem>
    </Flex>
  );
};

export default AdvancedSection;
