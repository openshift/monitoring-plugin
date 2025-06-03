import { useEffect, useRef } from 'react';

// Slightly modified from Dan Abramov's blog post about using React hooks for polling
// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export const usePoll = (callback, delay, ...dependencies) => {
  const savedCallback = useRef(null);
  const intervalId = useRef(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    const tick = () => savedCallback.current();

    tick(); // Run first tick immediately.

    if (delay) {
      // Only start interval if a delay is provided.
      intervalId.current = setInterval(tick, delay);
      return () => clearInterval(intervalId.current);
    }

    // If delay is 0, clear the interval.
    if (delay === 0 && intervalId.current) {
      clearInterval(intervalId.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps

    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...dependencies]);
};
