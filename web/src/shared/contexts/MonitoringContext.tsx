import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { createContext, FC, PropsWithChildren, useMemo } from 'react';
import { useLocation } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { Perspective, PerspectiveName } from '@/shared/constants/perspective';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';
import { MonitoringPlugins, Prometheus } from '@/shared/utils/utils';

type MonitoringContextType = {
  /** Perspective of the page route, independent of the active Console perspective. */
  perspective: Perspective;
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
  /**
   * Dictates if the namespace selector is shown inside the view,
   * in some perspectives the selector already exist outside monitoring components scope
   */
  displayNamespaceSelector: boolean;
};

export const MonitoringContext = createContext<MonitoringContextType>({
  perspective: PerspectiveName.Admin,
  plugin: 'monitoring-plugin',
  prometheus: 'cmo',
  useAlertsTenancy: false,
  useMetricsTenancy: false,
  accessCheckLoading: true,
  displayNamespaceSelector: true,
});

const getPerspectiveForPath = (pathname: string): Perspective => {
  const root = pathname.split('/')[1];
  switch (root) {
    case 'multicloud':
      return PerspectiveName.ACM;
    case 'dev-monitoring':
      return PerspectiveName.Developer;
    case 'virt-monitoring':
      return PerspectiveName.Virtualization;
    default:
      return PerspectiveName.Admin;
  }
};

export const MonitoringProvider: FC<
  PropsWithChildren<{
    monitoringContext: {
      plugin: MonitoringPlugins;
      prometheus: Prometheus;
      displayNamespaceSelector?: boolean;
    };
  }>
> = ({ children, monitoringContext }) => {
  const { pathname } = useLocation();
  const perspective = getPerspectiveForPath(pathname);
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
      perspective,
      // We only need to use the tenancy path when we are querying the in cluster monitoring
      useAlertsTenancy: monitoringContext.prometheus === 'cmo' && !allNamespaceAlertsTenancy,
      useMetricsTenancy: monitoringContext.prometheus === 'cmo' && !allNamespaceMeticsTenancy,
      accessCheckLoading: alertAccessCheckLoading || metricsAccessCheckLoading,
      displayNamespaceSelector: monitoringContext.displayNamespaceSelector ?? true,
    };
  }, [
    monitoringContext,
    perspective,
    allNamespaceAlertsTenancy,
    alertAccessCheckLoading,
    allNamespaceMeticsTenancy,
    metricsAccessCheckLoading,
  ]);

  return (
    <MonitoringContext.Provider value={monContext}>
      <QueryParamProvider adapter={ReactRouter7Adapter}>{children}</QueryParamProvider>
    </MonitoringContext.Provider>
  );
};
