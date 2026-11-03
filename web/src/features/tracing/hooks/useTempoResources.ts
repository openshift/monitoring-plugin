import { cancellableFetch, FetchError } from '../cancellable-fetch';
import { APIResponse, BACKEND_URL } from './api';
import { useQuery } from '@tanstack/react-query';

/**
 * Definition of a TempoStack or TempoMonolithic Custom Resource in the cluster.
 * This is different from TempoInstance, which represents a selected Tempo instance including the tenant.
 */
export type TempoResource = {
  kind: 'TempoStack' | 'TempoMonolithic';
  namespace: string;
  name: string;
  /** list of tenants for multi-tenant instances, undefined for single-tenant instances */
  tenants?: string[];
};

type ListTempoResourcesResponse = APIResponse<TempoResource[]>;

const isTempoStackListResponse = (value: unknown): value is TempoResource => {
  const obj = value as TempoResource;
  return (
    obj.namespace !== undefined &&
    typeof obj.namespace === 'string' &&
    obj.name !== undefined &&
    typeof obj.name === 'string'
  );
};

export function useTempoResources() {
  return useQuery<TempoResource[], FetchError>({
    queryKey: ['useTempoResources'],
    queryFn: async function () {
      const { request } = cancellableFetch<ListTempoResourcesResponse>(
        `${BACKEND_URL}/api/v1/list-tempo-resources`,
      );
      const response = await request();

      if (
        response &&
        response.status === 'success' &&
        Array.isArray(response.data) &&
        response.data.every(isTempoStackListResponse)
      ) {
        return response.data;
      } else {
        throw new FetchError('Error retrieving Tempo resources', 500, response);
      }
    },
    staleTime: 60 * 1000, // cache response for 1m
  });
}
