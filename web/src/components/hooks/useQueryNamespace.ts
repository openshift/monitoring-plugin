import { useEffect } from 'react';
import { StringParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../query-params';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';

// Utility hook to syncronize the namespace parameter in the URL with the activeNamespace
// the console uses
export const useQueryNamespace = () => {
  const [queryNamespace, setQueryNamespace] = useQueryParam(QueryParams.Namespace, StringParam);
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();

  useEffect(() => {
    if (queryNamespace && activeNamespace !== queryNamespace) {
      setActiveNamespace(queryNamespace);
    }
    if (!queryNamespace) {
      setQueryNamespace(activeNamespace);
    }
  }, [queryNamespace, activeNamespace, setActiveNamespace]);

  return {
    namespace: queryNamespace,
    setNamespace: setQueryNamespace,
  };
};
