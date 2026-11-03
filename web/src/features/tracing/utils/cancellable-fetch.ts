export type CancellableFetch<T> = {
  request: () => Promise<T>;
  abort: () => void;
};

export type RequestInitWithTimeout = RequestInit & { timeout?: number };

class TimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request: ${url} timed out after ${ms}ms.`);
  }
}

export class FetchError extends Error {
  status: number;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, status: number, json?: any) {
    super(message);
    this.name = 'Fetch Error';
    this.status = status;
    this.json = json;
  }
}

export const isFetchError = (error: unknown): error is FetchError =>
  !!(error as FetchError).name && (error as FetchError).name === 'Fetch Error';

/**
 * fetches a resource from the network
 * @returns a JavaScript object representing the returned JSON body of the response
 * @throws FetchError(message, status, json?)
 */
export const cancellableFetch = <T>(
  url: string,
  init?: RequestInitWithTimeout,
): CancellableFetch<T> => {
  const abortController = new AbortController();
  const abort = () => abortController.abort();

  const fetchPromise = fetch(url, {
    ...init,
    headers: { ...init?.headers, Accept: 'application/json' },
    signal: abortController.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const json = await response.json();
        throw new FetchError(json.error, response.status, json);
      }

      const text = await response.text();
      throw new FetchError(text, response.status);
    }
    return response.json();
  });

  const timeout = init?.timeout ?? 30 * 1000;

  if (timeout <= 0) {
    return { request: () => fetchPromise, abort };
  }

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    setTimeout(() => {
      abort();
      reject(new TimeoutError(url.toString(), timeout));
    }, timeout);
  });

  const request = () => Promise.race([fetchPromise, timeoutPromise]);

  return { request, abort };
};
