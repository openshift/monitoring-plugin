import { useContext } from 'react';
import { MonitoringContext } from '../contexts/MonitoringContext';

export const useMonitoring = () => {
  const { prometheus, plugin } = useContext(MonitoringContext);
  return {
    prometheus,
    plugin,
  };
};
