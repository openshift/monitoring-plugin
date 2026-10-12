// Console's ResourceLink is mocked only in this isolated test harness.
export const ResourceLink = ({ name, namespace }: { name: string; namespace?: string }) => (
  <a href={`/k8s/ns/${namespace}/pods/${name}`}>{name}</a>
);
export { WSFactory } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory';

export const useK8sWatchResource = () => [null, true, ''];
export const useActivePerspective = () => ['admin'];
export const useAccessReview = () => [true, false];

const fetchJSON = async (url: string, method = 'GET', options?: RequestInit, timeout?: number) => {
  const controller = options?.signal ? undefined : new AbortController();
  const signal = options?.signal ?? controller?.signal;

  const timeoutId =
    timeout && timeout > 0 && controller
      ? setTimeout(() => controller.abort(), timeout)
      : undefined;

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers: {
        ...options?.headers,
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text) as Error & { response: { status: number } };
      error.response = { status: response.status };
      throw error;
    }

    return response.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

fetchJSON.post = async (url: string, json: unknown, options?: RequestInit, timeout?: number) =>
  fetchJSON(
    url,
    'POST',
    { ...options, body: typeof json === 'string' ? json : JSON.stringify(json) },
    timeout,
  );

fetchJSON.delete = async (url: string, json: unknown, options?: RequestInit, timeout?: number) =>
  fetchJSON(
    url,
    'DELETE',
    { ...options, body: typeof json === 'string' ? json : JSON.stringify(json) },
    timeout,
  );

fetchJSON.put = async (url: string, json: unknown, options?: RequestInit, timeout?: number) =>
  fetchJSON(
    url,
    'PUT',
    { ...options, body: typeof json === 'string' ? json : JSON.stringify(json) },
    timeout,
  );

fetchJSON.patch = async (url: string, json: unknown, options?: RequestInit, timeout?: number) =>
  fetchJSON(
    url,
    'PATCH',
    { ...options, body: typeof json === 'string' ? json : JSON.stringify(json) },
    timeout,
  );

export const consoleFetchJSON = fetchJSON;
