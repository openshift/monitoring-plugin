import React from 'react';
import { MonitoringPlugins, Prometheus } from '../components/utils';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';

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
}) => (
  <MonitoringContext.Provider value={monitoringContext}>
    <QueryParamProvider adapter={ReactRouter5Adapter}>{children}</QueryParamProvider>
  </MonitoringContext.Provider>
);
