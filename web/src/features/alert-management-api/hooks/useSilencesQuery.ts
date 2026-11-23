import { consoleFetchJSON, k8sListItems, Silence } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';

import { getMockSilencesResponse } from '@/features/alert-management-api/tests/fixtures/mock-responses';
import { ProjectModel } from '@/shared/console/models';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getAlertmanagerSilencesUrl, Prometheus } from '@/shared/utils/utils';

const useMockResponses = process.env.NODE_ENV === 'development';

const fetchSilences = async (prometheus: Prometheus, signal?: AbortSignal): Promise<Silence[]> => {
  const nonTenancySilencesUrl = getAlertmanagerSilencesUrl({ prometheus, useTenancyPath: false });

  try {
    return await consoleFetchJSON(nonTenancySilencesUrl, 'GET', { signal });
  } catch (error) {
    signal?.throwIfAborted();

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

    // Each tenancy request is also an RBAC check. Wait for all of them to complete
    // so any namespace success is a overall success
    const responses = await Promise.allSettled(
      namespaces.map(
        (namespace: string): Promise<Silence[]> =>
          consoleFetchJSON(
            getAlertmanagerSilencesUrl({ prometheus, useTenancyPath: true, namespace }),
            'GET',
            { signal },
          ),
      ),
    );
    signal?.throwIfAborted();

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
