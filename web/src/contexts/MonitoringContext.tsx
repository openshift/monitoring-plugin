import React from 'react';
import { MonitoringPlugins, Prometheus } from '../components/utils';

type MonitoringContextType = {
  /** Dictates which plugin this code is being run in */
  plugin: MonitoringPlugins;
  /** Dictates which prometheus instance this code should contact */
  prometheus: Prometheus;
};

export const MonitoringContext = React.createContext<MonitoringContextType>({
  plugin: 'monitoring-plugin',
  prometheus: 'cmo',
});

export const MonitoringProvider: React.FC<{ monitoringContext: MonitoringContextType }> = ({
  children,
  monitoringContext,
}) => <MonitoringContext.Provider value={monitoringContext}>{children}</MonitoringContext.Provider>;
