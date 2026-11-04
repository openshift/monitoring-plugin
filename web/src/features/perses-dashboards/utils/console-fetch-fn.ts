import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import type { FetchFn } from '@perses-dev/client';

/**
 * Adapts `consoleFetch` (which takes `(url: string, options?)`) to Perses'
 * native-`fetch`-shaped `FetchFn`, whose first argument may be a `string`,
 * `URL`, or `Request`. Normalizes all three into the `(url, options)` form so
 * future Perses versions that pass `URL`/`Request` inputs keep working.
 */
export const consoleFetchFn: FetchFn = async (input, init) => {
  if (typeof input === 'string' || input instanceof URL) {
    return consoleFetch(input.toString(), init);
  }

  // Merge `init` over the Request (init wins, per `fetch` semantics).
  const request = new Request(input, init);
  const options: RequestInit = {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    signal: request.signal,
    credentials: request.credentials,
    mode: request.mode,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
  };

  // Buffer the body so `consoleFetch` can forward it without the `duplex` option
  // that streaming request bodies require. GET/HEAD cannot have a body.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;
  return consoleFetch(request.url, { ...options, body });
};
