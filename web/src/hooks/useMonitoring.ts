import { useContext } from 'react';
import { MonitoringContext } from '../contexts/MonitoringContext';

export const useMonitoring = () => {
  const { prometheus, plugin, useAlertsTenancy, useMetricsTenancy, accessCheckLoading } =
    useContext(MonitoringContext);
  return {
    prometheus,
    plugin,
    useAlertsTenancy,
    useMetricsTenancy,
    accessCheckLoading,
  };
};
