import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/overview/components/summary/SummaryCard';
import { CapabilityStatus, ObservabilityCapability } from '@/features/overview/types/types';

type CapabilitiesSummaryCardProps = {
  observabilityCapabilities: ObservabilityCapability[];
};

const CapabilitiesSummaryCard: FC<CapabilitiesSummaryCardProps> = ({
  observabilityCapabilities,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const readyCount = observabilityCapabilities.filter(
    (capability) => capability.status === CapabilityStatus.Ready,
  ).length;

  return (
    <SummaryCard
      cardId="capabilities-ready"
      count={`${readyCount}/${observabilityCapabilities.length}`}
      title={t('Capabilities ready')}
      footer={t('Ready')}
      error={undefined}
    />
  );
};

export default CapabilitiesSummaryCard;
