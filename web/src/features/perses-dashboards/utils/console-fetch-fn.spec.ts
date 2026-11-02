import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import type { Mock } from 'vitest';

import { consoleFetchFn } from '@/features/perses-dashboards/utils/console-fetch-fn';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  consoleFetch: vi.fn(() => Promise.resolve(new Response('ok'))),
}));

const mockConsoleFetch = consoleFetch as unknown as Mock;

describe('consoleFetchFn', () => {
  beforeEach(() => {
    mockConsoleFetch.mockClear();
    mockConsoleFetch.mockResolvedValue(new Response('ok'));
  });

  it('forwards a string input unchanged with its init', async () => {
    const init: RequestInit = { method: 'POST', body: 'query=up' };

    await consoleFetchFn('https://example.com/api/v1/query', init);

    expect(mockConsoleFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockConsoleFetch.mock.calls[0];
    expect(url).toBe('https://example.com/api/v1/query');
    expect(options).toBe(init);
  });

  it('converts a URL input to a string and forwards its init', async () => {
    const init: RequestInit = { method: 'POST' };

    await consoleFetchFn(new URL('https://example.com/api/v1/query'), init);

    const [url, options] = mockConsoleFetch.mock.calls[0];
    expect(url).toBe('https://example.com/api/v1/query');
    expect(options).toBe(init);
  });

  it('flattens a Request input, preserving the method, headers, and signal', async () => {
    const controller = new AbortController();
    const request = new Request('https://example.com/api/v1/query', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
      body: 'query=up',
      signal: controller.signal,
    });

    await consoleFetchFn(request);

    const [url, options] = mockConsoleFetch.mock.calls[0];
    expect(url).toBe('https://example.com/api/v1/query');
    expect(options.method).toBe('POST');
    expect((options.headers as Headers).get('X-Custom')).toBe('value');

    expect(options.signal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(options.signal.aborted).toBe(true);
  });

  it('buffers a Request body so consoleFetch receives the payload', async () => {
    const request = new Request('https://example.com/api/v1/query', {
      method: 'POST',
      body: 'query=up&time=123',
    });

    await consoleFetchFn(request);

    const [, options] = mockConsoleFetch.mock.calls[0];
    expect(new TextDecoder().decode(options.body)).toBe('query=up&time=123');
  });

  it('does not attach a body for GET/HEAD Request inputs', async () => {
    const request = new Request('https://example.com/api/v1/labels', { method: 'GET' });

    await consoleFetchFn(request);

    const [, options] = mockConsoleFetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  it('lets init override the Request (effective values win)', async () => {
    const request = new Request('https://example.com/api/v1/query', { method: 'GET' });

    await consoleFetchFn(request, { method: 'POST', body: 'query=up' });

    const [url, options] = mockConsoleFetch.mock.calls[0];
    expect(url).toBe('https://example.com/api/v1/query');
    expect(options.method).toBe('POST');
    expect(new TextDecoder().decode(options.body)).toBe('query=up');
  });

  it('returns the Response produced by consoleFetch', async () => {
    const expected = new Response('body', { status: 201 });
    mockConsoleFetch.mockResolvedValueOnce(expected);

    const result = await consoleFetchFn('https://example.com/api/v1/query');

    expect(result).toBe(expected);
  });
});
