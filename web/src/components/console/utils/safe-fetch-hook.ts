import { useEffect, useRef } from 'react';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

// Disable client-side timeout (-1) to let the backend control query timeouts
const NO_TIMEOUT = -1;

export const useSafeFetch = () => {
  const controller = useRef<AbortController>();
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);

  return <T>(url: string): Promise<T> =>
    consoleFetchJSON(url, 'GET', { signal: controller.current.signal as AbortSignal }, NO_TIMEOUT);
};
