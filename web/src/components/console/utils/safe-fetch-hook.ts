import { useEffect, useRef } from 'react';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

export const useSafeFetch = () => {
  const controller = useRef<AbortController>();
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);

  return (url) =>
    consoleFetchJSON(url, 'get', { signal: controller.current.signal as AbortSignal });
};
