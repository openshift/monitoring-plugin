import React, { useMemo } from 'react';
import { MonitoringPlugins, Prometheus } from '../components/utils';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';

type MonitoringContextType = {
  /** Dictates which plugin this code is being run in */
  plugin: MonitoringPlugins;
  /** Dictates which prometheus instance this code should contact */
  prometheus: Prometheus;
  /** Dictates if the user has accesss to alerts in ALL namespaces
   *  If so, then don't show the namespace bar on alerting pages
   */
  useAlertsTenancy: boolean;
  /** Dictates if the user has accesss to alerts in ALL namespaces
   *  If so, then don't show the namespace bar on alerting pages
   */
  useMetricsTenancy: boolean;
  /** Dictates if the users access is being loaded. */
  accessCheckLoading: boolean;
};

export const MonitoringContext = React.createContext<MonitoringContextType>({
  plugin: 'monitoring-plugin',
  prometheus: 'cmo',
  useAlertsTenancy: false,
  useMetricsTenancy: false,
  accessCheckLoading: true,
});

export const MonitoringProvider: React.FC<{
  monitoringContext: {
    plugin: MonitoringPlugins;
    prometheus: Prometheus;
  };
}> = ({ children, monitoringContext }) => {
  const [allNamespaceAlertsTenancy, alertAccessCheckLoading] = useAccessReview({
    group: 'monitoring.coreos.com',
    resource: 'prometheusrules',
    verb: 'get',
    namespace: '*',
  });
  const [allNamespaceMeticsTenancy, metricsAccessCheckLoading] = useAccessReview({
    group: 'monitoring.coreos.com',
    resource: 'prometheuses/api',
    verb: 'get',
    name: 'k8s',
    namespace: '*',
  });

  const monContext = useMemo(() => {
    return {
      ...monitoringContext,
      useAlertsTenancy: !allNamespaceAlertsTenancy,
      useMetricsTenancy: !allNamespaceMeticsTenancy,
      accessCheckLoading: alertAccessCheckLoading || metricsAccessCheckLoading,
    };
  }, [
    monitoringContext,
    allNamespaceAlertsTenancy,
    alertAccessCheckLoading,
    allNamespaceMeticsTenancy,
    metricsAccessCheckLoading,
  ]);

  return (
    <MonitoringContext.Provider value={monContext}>
      <QueryParamProvider adapter={ReactRouter5Adapter}>{children}</QueryParamProvider>
    </MonitoringContext.Provider>
  );
};
