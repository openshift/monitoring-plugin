/* eslint-disable react-hooks/exhaustive-deps */
import { UseURLPoll } from '@openshift-console/dynamic-plugin-sdk/lib/api/internal-types';
import { useCallback, useState } from 'react';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { usePoll } from '../console/utils/poll-hook';

export const URL_POLL_DEFAULT_DELAY = 15000; // 15 seconds

export const useURLPoll: UseURLPoll = <R>(
  url: string,
  delay = URL_POLL_DEFAULT_DELAY,
  ...dependencies: any[]
) => {
  const [error, setError] = useState();
  const [response, setResponse] = useState<R>();
  const [loading, setLoading] = useState(true);
  const safeFetch = useSafeFetch();
  const tick = useCallback(() => {
    if (url) {
      safeFetch(url)
        .then((data) => {
          setResponse(data);
          setError(null);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setResponse(null);
            setError(err);
            // eslint-disable-next-line no-console
            console.error(`Error polling URL: ${err}`);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [url]);

  usePoll(tick, delay, ...dependencies);

  return [response, error, loading];
};
