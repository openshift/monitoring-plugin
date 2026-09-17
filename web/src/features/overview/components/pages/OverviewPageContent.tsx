import { K8sResourceKind, WatchK8sResult } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, PageSection } from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import AdvancedSection from '@/features/overview/components/capabilities/AdvancedSection';
import CapabilitiesSection from '@/features/overview/components/capabilities/CapabilitiesSection';
import StackSummary from '@/features/overview/components/summary/StackSummary';
import { useObservabilityCapabilities } from '@/features/overview/hooks/useObservabilityCapabilities';
import { ObservabilityCapability } from '@/features/overview/types/types';

const capabilitiesSort = (a: ObservabilityCapability, b: ObservabilityCapability) =>
  a.status - b.status;

interface OverviewPageContentProps {
  csvResults: WatchK8sResult<K8sResourceKind[]>;
}

const OverviewPageContent: FC<OverviewPageContentProps> = ({ csvResults }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [, , csvsLoadError] = csvResults;
  const { observabilityCapabilities, monitoringPlugin, loaded, loadError } =
    useObservabilityCapabilities(csvResults);

  const capabilities = observabilityCapabilities
    .filter((capability) => !capability.isAdvanced)
    .sort(capabilitiesSort);
  const advanced = observabilityCapabilities
    .filter((capability) => capability.isAdvanced)
    .sort(capabilitiesSort);

  return (
    <>
      {csvsLoadError ? (
        <PageSection>
          <Alert
            isInline
            variant="danger"
            title={t('Unable to determine services installation status')}
          >
            <p>{typeof csvsLoadError === 'string' ? csvsLoadError : csvsLoadError?.message}</p>
          </Alert>
        </PageSection>
      ) : null}
      {loadError ? (
        <PageSection>
          <Alert
            isInline
            variant="danger"
            title={t('There were some issues loading capability status.')}
          >
            <p>{typeof loadError === 'string' ? loadError : loadError?.message}</p>
          </Alert>
        </PageSection>
      ) : null}
      <PageSection hasShadowTop>
        <StackSummary observabilityCapabilities={observabilityCapabilities} loaded={loaded} />
      </PageSection>
      <PageSection>
        <CapabilitiesSection
          capabilities={capabilities}
          monitoringPlugin={monitoringPlugin}
          loaded={loaded}
        />
      </PageSection>
      <PageSection>
        <AdvancedSection
          capabilities={advanced}
          monitoringPlugin={monitoringPlugin}
          loaded={loaded}
        />
      </PageSection>
    </>
  );
};

export default OverviewPageContent;
