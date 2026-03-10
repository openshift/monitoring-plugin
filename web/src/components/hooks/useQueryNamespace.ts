import { useEffect } from 'react';
import { StringParam, useQueryParam } from 'use-query-params';
import { useParams } from 'react-router-dom-v5-compat';
import { QueryParams } from '../query-params';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';

/**
 * Utility hook to synchronize the namespace parameter in the URL with the activeNamespace
 * the console uses. It checks for namespace in the following order:
 * 1. Route param `:ns` (used in dev console routes like /dev-monitoring/ns/:ns/...)
 * 2. Query param `namespace` (used in admin/virt perspectives)
 * 3. Active namespace from console SDK
 */
export const useQueryNamespace = () => {
  const { ns: routeNamespace } = useParams<{ ns?: string }>();
  const [queryNamespace, setQueryNamespace] = useQueryParam(QueryParams.Namespace, StringParam);
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();

  useEffect(() => {
    const namespaceToSync = routeNamespace || queryNamespace;
    if (namespaceToSync && activeNamespace !== namespaceToSync) {
      setActiveNamespace(namespaceToSync);
    }
  }, [routeNamespace, queryNamespace, activeNamespace, setActiveNamespace]);

  return {
    namespace: routeNamespace || queryNamespace || activeNamespace,
    setNamespace: setQueryNamespace,
  };
};
