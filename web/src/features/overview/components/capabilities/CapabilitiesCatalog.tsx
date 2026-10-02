import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { Grid, GridItem } from '@patternfly/react-core';
import { type FC } from 'react';

import { CapabilityCard } from '@/features/overview/components/capabilities/CapabilityCard';
import { ObservabilityCapability } from '@/features/overview/types/types';

type CapabilitiesCatalogProps = {
  capabilities: ObservabilityCapability[];
  monitoringPlugin: K8sResourceKind;
};

export const CapabilitiesCatalog: FC<CapabilitiesCatalogProps> = ({
  capabilities,
  monitoringPlugin,
}) => (
  <Grid hasGutter>
    {capabilities.map((service) => (
      <GridItem key={service.id} sm={12} md={6} lg={3}>
        <CapabilityCard capability={service} monitoringPlugin={monitoringPlugin} />
      </GridItem>
    ))}
  </Grid>
);
