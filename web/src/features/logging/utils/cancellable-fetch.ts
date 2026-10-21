import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

export type CancellableFetch<T> = {
  request: () => Promise<T>;
  abort: () => void;
};

class TimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request: ${url} timed out after ${ms}ms.`);
  }
}

class FetchError extends Error {
  status: number;
  name: string;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'Fetch Error';
    this.status = status;
  }
}

export const isFetchError = (error: unknown): error is FetchError =>
  !!error &&
  typeof error === 'object' &&
  'name' in error &&
  (error as FetchError).name === 'Fetch Error';

export const cancellableFetch = <T>(
  url: string,
  init?: RequestInit,
  timeout?: number,
): CancellableFetch<T> => {
  const abortController = new AbortController();
  const abort = () => abortController.abort();

  const fetchPromise = async (): Promise<T> => {
    const requestTimeout = timeout ?? 30 * 1000;

    try {
      const method = init?.method || 'GET';

      const options: RequestInit = {
        ...init,
        signal: abortController.signal,
      };

      let result: T;

      if (method.toUpperCase() === 'POST') {
        result = await consoleFetchJSON.post(
          url,
          init?.body,
          options,
          requestTimeout > 0 ? requestTimeout : undefined,
        );
      } else {
        result = await consoleFetchJSON(
          url,
          method,
          options,
          requestTimeout > 0 ? requestTimeout : undefined,
        );
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw error;
        }

        if (error.message.includes('timed out') || error.message.includes('timeout')) {
          throw new TimeoutError(url.toString(), requestTimeout);
        }

        const errorWithStatus = error as Error & {
          status?: number;
          response?: { status?: number };
        };
        const status = errorWithStatus.status || errorWithStatus.response?.status || 500;
        throw new FetchError(error.message, status);
      }

      throw new FetchError('Network error', 500);
    }
  };

  return { request: fetchPromise, abort };
};
