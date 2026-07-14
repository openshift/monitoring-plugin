import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { useParams } from 'react-router';

/**
 * Utility hook to synchronize the namespace route in the URL with the activeNamespace
 * the console uses. It checks for namespace in the following order:
 * 1. Route param `:ns` (used in dev console routes like /dev-monitoring/ns/:ns/...)
 * 2. Active namespace from console SDK
 */
export const useMonitoringNamespace = () => {
  const { ns: routeNamespace } = useParams<{ ns?: string }>();
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();

  return {
    namespace: routeNamespace || activeNamespace,
    setNamespace: setActiveNamespace,
  };
};
