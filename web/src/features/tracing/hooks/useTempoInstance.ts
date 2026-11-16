import { useMemo } from 'react';
import { StringParam, useQueryParams } from 'use-query-params';

/** a selected Tempo instance, including the tenant for multi-tenant instances */
export interface TempoInstance {
  namespace: string;
  name: string;
  tenant: string | undefined;
}

const tempoQueryParams = {
  namespace: StringParam,
  name: StringParam,
  tenant: StringParam,
};

export function useTempoInstance(): [
  TempoInstance | undefined,
  (tempo: TempoInstance | undefined) => void,
] {
  const [queryParams, setQueryParams] = useQueryParams(tempoQueryParams, {
    updateType: 'replaceIn',
  });

  // either return a fully populated TempoInstance if all required params are set, or undefined
  const tempo = useMemo(() => {
    return queryParams.namespace && queryParams.name
      ? {
          namespace: queryParams.namespace,
          name: queryParams.name,
          tenant: queryParams.tenant ?? undefined, // convert null to undefined,
        }
      : undefined;
  }, [queryParams]);

  const setTempo = (tempo: TempoInstance | undefined) => {
    if (tempo) {
      setQueryParams(tempo);
    } else {
      setQueryParams({
        namespace: undefined,
        name: undefined,
        tenant: undefined,
      });
    }
  };

  return [tempo, setTempo];
}
