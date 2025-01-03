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

const getCSRFToken = () => {
  const cookiePrefix = 'csrf-token=';
  return (
    document &&
    document.cookie &&
    document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c.startsWith(cookiePrefix))
      .map((c) => c.slice(cookiePrefix.length))
      .pop()
  );
};

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
  !!(error as FetchError).name && (error as FetchError).name === 'Fetch Error';

export const proxiedFetch = <T>(url: string, init?: RequestInitWithTimeout): Promise<T> => {
  const fetchPromise = fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Accept: 'application/json',
      ...(init?.method === 'POST' ? { 'X-CSRFToken': getCSRFToken() } : {}),
    },
  }).then(async (response): Promise<T> => {
    if (!response.ok) {
      const text = await response.text();
      throw new FetchError(text, response.status);
    }
    return response.json();
  });

  const timeout = init?.timeout ?? 30 * 1000;

  if (timeout <= 0) {
    return fetchPromise;
  }

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    setTimeout(() => reject(new TimeoutError(url.toString(), timeout)), timeout);
  });

  const request = Promise.race([fetchPromise, timeoutPromise]);

  return request;
};
