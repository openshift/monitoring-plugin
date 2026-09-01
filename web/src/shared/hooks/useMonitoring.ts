import { useContext } from 'react';

import { MonitoringContext } from '@/shared/contexts/MonitoringContext';

export const useMonitoring = () => {
  const {
    prometheus,
    plugin,
    useAlertsTenancy,
    useMetricsTenancy,
    accessCheckLoading,
    displayNamespaceSelector,
  } = useContext(MonitoringContext);
  return {
    prometheus,
    plugin,
    useAlertsTenancy,
    useMetricsTenancy,
    accessCheckLoading,
    displayNamespaceSelector,
  };
};
