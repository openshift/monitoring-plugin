import { consoleFetchJSON, k8sListItems, Silence } from '@openshift-console/dynamic-plugin-sdk';
import type { HttpError } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';

import { getMockSilencesResponse } from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { ProjectModel } from '@/shared/console/models';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getAlertmanagerSilencesUrl, Prometheus } from '@/shared/utils/utils';

const useMockResponses = process.env.NODE_ENV === 'development';
const MAX_CONCURRENT_SILENCE_REQUESTS = 25;

const fetchSilences = async (prometheus: Prometheus, signal?: AbortSignal): Promise<Silence[]> => {
  const nonTenancySilencesUrl = getAlertmanagerSilencesUrl({ prometheus, useTenancyPath: false });

  try {
    return await consoleFetchJSON(nonTenancySilencesUrl, 'GET', { signal });
  } catch (error) {
    signal?.throwIfAborted();

    // Only fan out permission errors
    const status = (error as HttpError)?.response?.status;
    if (status !== 403 && status !== 401) {
      throw error;
    }

    const projects = await k8sListItems({
      model: ProjectModel,
      queryParams: {},
      requestInit: { signal },
    });
    signal?.throwIfAborted();

    const namespaces = [
      ...new Set(projects.flatMap(({ metadata }) => (metadata?.name ? [metadata.name] : []))),
    ];

    if (namespaces.length === 0) {
      throw error;
    }

    // Each tenancy request is also an RBAC check. Bound concurrency and wait for all
    // namespaces so any namespace success counts as overall success.
    const responses: PromiseSettledResult<Silence[]>[] = [];
    for (let offset = 0; offset < namespaces.length; offset += MAX_CONCURRENT_SILENCE_REQUESTS) {
      const batch = namespaces.slice(offset, offset + MAX_CONCURRENT_SILENCE_REQUESTS);
      const batchResponses = await Promise.allSettled(
        batch.map(
          (namespace: string): Promise<Silence[]> =>
            consoleFetchJSON(
              getAlertmanagerSilencesUrl({ prometheus, useTenancyPath: true, namespace }),
              'GET',
              { signal },
            ),
        ),
      );
      signal?.throwIfAborted();
      responses.push(...batchResponses);
    }

    const successfulResponses = responses.filter(
      (response): response is PromiseFulfilledResult<Silence[]> => response.status === 'fulfilled',
    );
    if (successfulResponses.length === 0) {
      throw error;
    }

    const allSilences = successfulResponses.flatMap(({ value }) => value);
    const seenIds = new Set<string>();

    // deduplicate silences
    return allSilences.filter(({ id }) => {
      if (!id) {
        // malformed data
        return false;
      }
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
      return true;
    });
  }
};

export const useSilencesQuery = (refreshIntervalMs: number | false = false) => {
  const { prometheus } = useMonitoring();

  return useQuery<Silence[], Error>({
    queryKey: ['alert-management-api', prometheus, 'silences'],
    queryFn: ({ signal }) =>
      useMockResponses
        ? Promise.resolve(getMockSilencesResponse())
        : fetchSilences(prometheus, signal),
    // RBAC failures should not retry the fanout before surfacing an error
    retry: false,
    refetchInterval: refreshIntervalMs,
  });
};
