import { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import SummaryCard from '@/features/overview/components/summary/SummaryCard';
import {
  ObservabilityCapability,
  RequiredOperator,
  RequirementStatus,
} from '@/features/overview/types/types';

const getDegradedOperatorKey = (operator: RequiredOperator): string =>
  operator.csv?.metadata?.uid ?? operator.id;

type ComponentHealthSummaryCardProps = {
  observabilityCapabilities: ObservabilityCapability[];
};

export const ComponentHealthSummaryCard: FC<ComponentHealthSummaryCardProps> = ({
  observabilityCapabilities,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { healthyCount, degradedCount } = useMemo(() => {
    let healthyCount = 0;
    const degradedOperatorKeys = new Set<string>();

    observabilityCapabilities.forEach((observabilityService) => {
      let healthy = true;
      observabilityService.requiredOperators?.forEach((operator) => {
        if (operator.status !== RequirementStatus.Success) {
          healthy = false;
        }
        if (operator.status === RequirementStatus.Degraded) {
          degradedOperatorKeys.add(getDegradedOperatorKey(operator));
        }
      });
      observabilityService.requiredConfigs?.forEach((config) => {
        if (config.status !== RequirementStatus.Success) {
          healthy = false;
        }
      });
      if (healthy) {
        healthyCount++;
      }
    });
    return { healthyCount, degradedCount: degradedOperatorKeys.size };
  }, [observabilityCapabilities]);

  return (
    <SummaryCard
      cardId="component-health"
      count={degradedCount || healthyCount}
      title={t('Component health')}
      status={degradedCount || !healthyCount ? 'danger' : 'success'}
      footer={degradedCount || !healthyCount ? t('Degraded') : t('Healthy')}
    />
  );
};
