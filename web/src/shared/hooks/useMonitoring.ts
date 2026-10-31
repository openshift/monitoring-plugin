import { useContext } from 'react';

import { MonitoringContext } from '@/shared/contexts/MonitoringContext';

export const useMonitoring = () => {
  const {
    perspective,
    prometheus,
    plugin,
    useAlertsTenancy,
    useMetricsTenancy,
    accessCheckLoading,
    displayNamespaceSelector,
  } = useContext(MonitoringContext);
  return {
    perspective,
    prometheus,
    plugin,
    useAlertsTenancy,
    useMetricsTenancy,
    accessCheckLoading,
    displayNamespaceSelector,
  };
};
