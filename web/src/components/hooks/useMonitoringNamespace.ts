import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { useMonitoring } from '../../hooks/useMonitoring';

/**
 * Utility hook to synchronize the namespace route in the URL with the activeNamespace
 * the console uses. It checks for namespace in the following order:
 * 1. Route param `:ns` (used in dev console routes like /dev-monitoring/ns/:ns/...)
 * 2. Active namespace from console SDK
 */
export const useMonitoringNamespace = () => {
  const { ns: routeNamespace } = useParams<{ ns?: string }>();
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const { displayNamespaceSelector } = useMonitoring();

  useEffect(() => {
    if (routeNamespace && activeNamespace !== routeNamespace) {
      setActiveNamespace(routeNamespace);
    }
  }, [routeNamespace, activeNamespace, setActiveNamespace, displayNamespaceSelector]);

  return {
    namespace: routeNamespace || activeNamespace,
    setNamespace: setActiveNamespace,
  };
};
